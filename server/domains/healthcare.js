// server/domains/healthcare.js
// Domain actions for healthcare: drug interaction checks, protocol matching, patient summaries.

export default function registerHealthcareActions(registerLensAction) {
  /**
   * checkInteractions
   * Cross-reference the patient's current prescriptions for known drug-drug
   * interactions. artifact.data.prescriptions is an array of
   * { drug, rxcui, dose, route, frequency }.
   * params.knownInteractions is an optional lookup array of
   * { pair: [rxcui1, rxcui2], severity, description }.
   */
  registerLensAction("healthcare", "checkInteractions", async (ctx, artifact, params) => {
    const prescriptions = artifact.data.prescriptions || [];
    const knownInteractions = params.knownInteractions || artifact.data.knownInteractions || [];

    if (prescriptions.length < 2) {
      return { ok: true, result: { interactions: [], message: "Fewer than 2 active prescriptions; no interactions possible." } };
    }

    // Build a set of active RxCUI codes
    const activeCodes = new Set(prescriptions.map((p) => String(p.rxcui)));

    // Check every known interaction pair against the active list
    const found = [];
    for (const interaction of knownInteractions) {
      const [a, b] = (interaction.pair || []).map(String);
      if (activeCodes.has(a) && activeCodes.has(b)) {
        const drugA = prescriptions.find((p) => String(p.rxcui) === a);
        const drugB = prescriptions.find((p) => String(p.rxcui) === b);
        found.push({
          drugs: [drugA.drug, drugB.drug],
          rxcuis: [a, b],
          severity: interaction.severity || "unknown",
          description: interaction.description || "",
        });
      }
    }

    // Sort by severity: critical > major > moderate > minor > unknown
    const severityOrder = { critical: 0, major: 1, moderate: 2, minor: 3, unknown: 4 };
    found.sort((x, y) => (severityOrder[x.severity] ?? 4) - (severityOrder[y.severity] ?? 4));

    // Persist the check result onto the artifact
    artifact.data.lastInteractionCheck = {
      timestamp: new Date().toISOString(),
      interactionsFound: found.length,
      interactions: found,
    };

    return {
      ok: true,
      result: {
        interactions: found,
        totalChecked: prescriptions.length,
        interactionsFound: found.length,
        hasCritical: found.some((i) => i.severity === "critical"),
      },
    };
  });

  /**
   * protocolMatch
   * Match patient conditions (artifact.data.conditions) to care protocols
   * (artifact.data.protocols or params.protocols). Each protocol has
   * { id, name, triggerConditions: [...icd10], steps: [...] }.
   * A protocol matches when ALL of its triggerConditions are present in the
   * patient's active condition list.
   */
  registerLensAction("healthcare", "protocolMatch", async (ctx, artifact, params) => {
    const conditions = (artifact.data.conditions || []).map((c) =>
      typeof c === "string" ? c : c.icd10 || c.code
    );
    const protocols = params.protocols || artifact.data.protocols || [];

    if (conditions.length === 0) {
      return { ok: true, result: { matched: [], message: "No active conditions on record." } };
    }

    const conditionSet = new Set(conditions.map((c) => c.toUpperCase()));

    const matched = [];
    const partial = [];

    for (const protocol of protocols) {
      const triggers = (protocol.triggerConditions || []).map((t) => t.toUpperCase());
      if (triggers.length === 0) continue;

      const matchedTriggers = triggers.filter((t) => conditionSet.has(t));
      const matchRatio = matchedTriggers.length / triggers.length;

      if (matchRatio === 1) {
        matched.push({
          protocolId: protocol.id,
          name: protocol.name,
          matchRatio: 1,
          steps: protocol.steps || [],
          matchedConditions: matchedTriggers,
        });
      } else if (matchRatio >= 0.5) {
        partial.push({
          protocolId: protocol.id,
          name: protocol.name,
          matchRatio: Math.round(matchRatio * 100) / 100,
          missingConditions: triggers.filter((t) => !conditionSet.has(t)),
          matchedConditions: matchedTriggers,
        });
      }
    }

    artifact.data.protocolMatches = {
      timestamp: new Date().toISOString(),
      fullMatches: matched.length,
      partialMatches: partial.length,
      matched,
      partial,
    };

    return {
      ok: true,
      result: {
        matched,
        partial,
        conditionsEvaluated: conditions.length,
        protocolsEvaluated: protocols.length,
      },
    };
  });

  /**
   * generateSummary
   * Create a consolidated patient summary from encounters, labs, and
   * treatments stored in artifact.data.
   * Expects artifact.data.encounters, artifact.data.labs, artifact.data.treatments.
   */
  registerLensAction("healthcare", "generateSummary", async (ctx, artifact, params) => {
    const encounters = artifact.data.encounters || [];
    const labs = artifact.data.labs || [];
    const treatments = artifact.data.treatments || [];
    const prescriptions = artifact.data.prescriptions || [];
    const conditions = artifact.data.conditions || [];

    const periodDays = params.periodDays || 90;
    const cutoff = new Date(Date.now() - periodDays * 86400000);

    // Filter to the period
    const recentEncounters = encounters.filter((e) => new Date(e.date) >= cutoff);
    const recentLabs = labs.filter((l) => new Date(l.date) >= cutoff);
    const recentTreatments = treatments.filter((t) => new Date(t.startDate || t.date) >= cutoff);

    // Compute lab trends: for each test name, find most recent value and direction
    const labsByName = {};
    for (const lab of recentLabs) {
      const key = lab.testName || lab.name;
      if (!labsByName[key]) labsByName[key] = [];
      labsByName[key].push(lab);
    }

    const labTrends = {};
    for (const [name, values] of Object.entries(labsByName)) {
      const sorted = values.sort((a, b) => new Date(a.date) - new Date(b.date));
      const latest = sorted[sorted.length - 1];
      let trend = "stable";
      if (sorted.length >= 2) {
        const prev = sorted[sorted.length - 2];
        const latestVal = parseFloat(latest.value);
        const prevVal = parseFloat(prev.value);
        if (!isNaN(latestVal) && !isNaN(prevVal)) {
          const change = ((latestVal - prevVal) / Math.abs(prevVal || 1)) * 100;
          if (change > 5) trend = "increasing";
          else if (change < -5) trend = "decreasing";
        }
      }
      const isAbnormal =
        latest.referenceRange &&
        (parseFloat(latest.value) < parseFloat(latest.referenceRange.low) ||
          parseFloat(latest.value) > parseFloat(latest.referenceRange.high));

      labTrends[name] = {
        latestValue: latest.value,
        latestDate: latest.date,
        unit: latest.unit || "",
        trend,
        abnormal: !!isAbnormal,
        sampleCount: sorted.length,
      };
    }

    // Encounter type breakdown
    const encounterTypes = {};
    for (const enc of recentEncounters) {
      const type = enc.type || "general";
      encounterTypes[type] = (encounterTypes[type] || 0) + 1;
    }

    // Active medications count
    const activeMedications = prescriptions.filter(
      (p) => p.status === "active" || !p.status
    ).length;

    const summary = {
      patientId: artifact.data.patientId || artifact.id,
      patientName: artifact.data.patientName || artifact.title,
      periodDays,
      generatedAt: new Date().toISOString(),
      activeConditions: conditions.map((c) => (typeof c === "string" ? c : c.name || c.code)),
      encounterSummary: {
        total: recentEncounters.length,
        byType: encounterTypes,
        lastEncounter: recentEncounters.length
          ? recentEncounters.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
          : null,
      },
      labSummary: {
        totalTests: recentLabs.length,
        uniqueTests: Object.keys(labTrends).length,
        trends: labTrends,
        abnormalCount: Object.values(labTrends).filter((t) => t.abnormal).length,
      },
      treatmentSummary: {
        activeTreatments: recentTreatments.length,
        activeMedications,
      },
    };

    artifact.data.latestSummary = summary;

    return { ok: true, result: summary };
  });
};
