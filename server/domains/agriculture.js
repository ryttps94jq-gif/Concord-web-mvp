// server/domains/agriculture.js
// Domain actions for agriculture: crop rotation, yield analysis, equipment, irrigation.

export default function registerAgricultureActions(registerLensAction) {
  /**
   * rotationPlan
   * Suggest the next crop based on rotation history and agronomic compatibility.
   * artifact.data.fields: [{ fieldId, name, acreage, soilType, history: [{ year, season, crop, yieldPerAcre }] }]
   * artifact.data.rotationRules: [{ previousCrop, recommendedNext: [...], avoid: [...] }]
   */
  registerLensAction("agriculture", "rotationPlan", (ctx, artifact, params) => {
    const fields = artifact.data.fields || [];
    const rules = artifact.data.rotationRules || params.rotationRules || [];

    const rulesMap = {};
    for (const rule of rules) {
      rulesMap[(rule.previousCrop || "").toLowerCase()] = {
        recommended: (rule.recommendedNext || []).map((c) => c.toLowerCase()),
        avoid: (rule.avoid || []).map((c) => c.toLowerCase()),
      };
    }

    const suggestions = fields.map((field) => {
      const history = (field.history || []).sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return (b.season || "").localeCompare(a.season || "");
      });

      const lastCrop = history.length > 0 ? (history[0].crop || "").toLowerCase() : null;
      const last3Crops = history.slice(0, 3).map((h) => (h.crop || "").toLowerCase());

      // Check rotation rules
      const rule = lastCrop ? rulesMap[lastCrop] : null;
      const recommended = rule ? rule.recommended : [];
      const avoid = rule ? rule.avoid : [];

      // Also avoid repeating any of the last 3 crops
      const avoidSet = new Set([...avoid, ...last3Crops]);

      // Filter recommended by removing any that should be avoided
      const filtered = recommended.filter((c) => !avoidSet.has(c));

      // If no rule-based recommendations, suggest anything not in avoid set
      const allCrops = [...new Set(rules.flatMap((r) => [...(r.recommendedNext || []), r.previousCrop]).map((c) => (c || "").toLowerCase()))];
      const fallback = allCrops.filter((c) => !avoidSet.has(c));

      const suggestions = filtered.length > 0 ? filtered : fallback;

      // Calculate soil benefit score — simple heuristic: nitrogen fixers get a bonus after heavy feeders
      const nitrogenFixers = ["soybean", "clover", "alfalfa", "peas", "beans", "lentils"];
      const heavyFeeders = ["corn", "wheat", "cotton"];

      let soilNote = "";
      if (lastCrop && heavyFeeders.includes(lastCrop)) {
        const fixerSuggestions = suggestions.filter((s) => nitrogenFixers.includes(s));
        if (fixerSuggestions.length > 0) {
          soilNote = `After ${lastCrop} (heavy feeder), consider nitrogen-fixing: ${fixerSuggestions.join(", ")}`;
        }
      }

      return {
        fieldId: field.fieldId,
        fieldName: field.name,
        acreage: field.acreage,
        soilType: field.soilType,
        lastCrop: history[0] ? history[0].crop : "none",
        last3Crops: history.slice(0, 3).map((h) => h.crop),
        suggestedNext: suggestions,
        avoid: [...avoidSet],
        soilNote,
      };
    });

    artifact.data.rotationPlan = {
      generatedAt: new Date().toISOString(),
      fields: suggestions,
    };

    return { ok: true, result: { fields: suggestions } };
  });

  /**
   * yieldAnalysis
   * Compare actual vs expected yield across fields.
   * artifact.data.fields: same structure with history entries having yieldPerAcre and expectedYield
   * params.season, params.year — filter to a specific growing season
   */
  registerLensAction("agriculture", "yieldAnalysis", (ctx, artifact, params) => {
    const fields = artifact.data.fields || [];
    const targetYear = params.year || new Date().getFullYear();
    const targetSeason = params.season || null;

    const results = [];
    let totalActual = 0;
    let totalExpected = 0;
    let totalAcreage = 0;

    for (const field of fields) {
      const history = field.history || [];
      const matching = history.filter((h) => {
        if (h.year !== targetYear) return false;
        if (targetSeason && h.season !== targetSeason) return false;
        return true;
      });

      for (const entry of matching) {
        const acreage = parseFloat(field.acreage) || 0;
        const actual = parseFloat(entry.yieldPerAcre) || 0;
        const expected = parseFloat(entry.expectedYield) || 0;
        const totalFieldActual = Math.round(actual * acreage * 100) / 100;
        const totalFieldExpected = Math.round(expected * acreage * 100) / 100;
        const variance = expected > 0 ? Math.round(((actual - expected) / expected) * 10000) / 100 : 0;

        totalActual += totalFieldActual;
        totalExpected += totalFieldExpected;
        totalAcreage += acreage;

        // Historical average for this field + crop
        const sameFieldCrop = history.filter((h) => h.crop === entry.crop && h.year !== targetYear);
        const historicalAvg = sameFieldCrop.length > 0
          ? Math.round((sameFieldCrop.reduce((s, h) => s + (parseFloat(h.yieldPerAcre) || 0), 0) / sameFieldCrop.length) * 100) / 100
          : null;

        results.push({
          fieldId: field.fieldId,
          fieldName: field.name,
          crop: entry.crop,
          season: entry.season,
          acreage,
          actualYieldPerAcre: actual,
          expectedYieldPerAcre: expected,
          variancePct: variance,
          totalActualYield: totalFieldActual,
          totalExpectedYield: totalFieldExpected,
          historicalAvgYieldPerAcre: historicalAvg,
          status: variance >= 0 ? "at-or-above-target" : variance >= -10 ? "slightly-below" : "significantly-below",
        });
      }
    }

    const overallVariance = totalExpected > 0
      ? Math.round(((totalActual - totalExpected) / totalExpected) * 10000) / 100
      : 0;

    const report = {
      generatedAt: new Date().toISOString(),
      year: targetYear,
      season: targetSeason || "all",
      fieldsAnalyzed: results.length,
      totalAcreage: Math.round(totalAcreage * 100) / 100,
      totalActualYield: Math.round(totalActual * 100) / 100,
      totalExpectedYield: Math.round(totalExpected * 100) / 100,
      overallVariancePct: overallVariance,
      fields: results.sort((a, b) => a.variancePct - b.variancePct),
    };

    artifact.data.yieldAnalysis = report;

    return { ok: true, result: report };
  });

  /**
   * equipmentDue
   * Flag equipment past its service interval.
   * artifact.data.equipment: [{ equipmentId, name, type, lastServiceDate, serviceIntervalHours, currentHours }]
   */
  registerLensAction("agriculture", "equipmentDue", (ctx, artifact, _params) => {
    const equipment = artifact.data.equipment || [];
    const now = new Date();

    const overdue = [];
    const upcoming = [];
    const current = [];

    for (const eq of equipment) {
      const lastService = eq.lastServiceDate ? new Date(eq.lastServiceDate) : null;
      const intervalHours = parseFloat(eq.serviceIntervalHours) || 250;
      const currentHours = parseFloat(eq.currentHours) || 0;
      const hoursAtLastService = parseFloat(eq.hoursAtLastService) || 0;
      const hoursSinceService = currentHours - hoursAtLastService;
      const hoursUntilDue = intervalHours - hoursSinceService;

      // Also check calendar-based interval
      const calendarIntervalDays = parseInt(eq.calendarIntervalDays) || 365;
      let daysSinceService = null;
      let daysUntilCalendarDue = null;
      if (lastService) {
        daysSinceService = Math.floor((now - lastService) / 86400000);
        daysUntilCalendarDue = calendarIntervalDays - daysSinceService;
      }

      const isHoursOverdue = hoursUntilDue <= 0;
      const isCalendarOverdue = daysUntilCalendarDue !== null && daysUntilCalendarDue <= 0;
      const isOverdue = isHoursOverdue || isCalendarOverdue;
      const isUpcoming = !isOverdue && (hoursUntilDue <= intervalHours * 0.1 || (daysUntilCalendarDue !== null && daysUntilCalendarDue <= 30));

      const entry = {
        equipmentId: eq.equipmentId,
        name: eq.name,
        type: eq.type,
        currentHours,
        hoursSinceService: Math.round(hoursSinceService * 10) / 10,
        serviceIntervalHours: intervalHours,
        hoursUntilDue: Math.round(hoursUntilDue * 10) / 10,
        lastServiceDate: eq.lastServiceDate,
        daysSinceService,
        daysUntilCalendarDue,
      };

      if (isOverdue) {
        overdue.push({ ...entry, status: "overdue" });
      } else if (isUpcoming) {
        upcoming.push({ ...entry, status: "upcoming" });
      } else {
        current.push({ ...entry, status: "current" });
      }
    }

    overdue.sort((a, b) => a.hoursUntilDue - b.hoursUntilDue);
    upcoming.sort((a, b) => a.hoursUntilDue - b.hoursUntilDue);

    const report = {
      checkedAt: new Date().toISOString(),
      totalEquipment: equipment.length,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      currentCount: current.length,
      overdue,
      upcoming,
    };

    artifact.data.equipmentServiceReport = report;

    return { ok: true, result: report };
  });

  /**
   * waterSchedule
   * Generate an irrigation schedule based on crop needs, soil type, and weather.
   * artifact.data.fields: [{ fieldId, name, acreage, soilType, crop, plantDate }]
   * artifact.data.weatherForecast: [{ date, highTemp, lowTemp, precipInches, humidity }] (optional)
   * params.daysAhead (default 7)
   */
  registerLensAction("agriculture", "waterSchedule", (ctx, artifact, params) => {
    const fields = artifact.data.fields || [];
    const forecast = artifact.data.weatherForecast || [];
    const daysAhead = params.daysAhead || 7;

    // Base water needs in inches/day by crop type (simplified)
    const cropWaterNeeds = {
      corn: 0.3, soybean: 0.25, wheat: 0.2, cotton: 0.28, alfalfa: 0.35,
      rice: 0.4, tomato: 0.22, potato: 0.2, default: 0.25,
    };

    // Soil water retention multipliers (sandy retains less, clay retains more)
    const soilRetention = {
      sandy: 0.6, loam: 1.0, clay: 1.3, "sandy-loam": 0.8, "clay-loam": 1.15, silt: 1.1, default: 1.0,
    };

    const schedules = fields.map((field) => {
      const cropKey = (field.crop || "default").toLowerCase();
      const soilKey = (field.soilType || "default").toLowerCase();
      const baseNeed = cropWaterNeeds[cropKey] || cropWaterNeeds.default;
      const retention = soilRetention[soilKey] || soilRetention.default;

      // Generate daily schedule
      const dailySchedule = [];
      const today = new Date();

      for (let d = 0; d < daysAhead; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().split("T")[0];

        // Find weather data for this date
        const weather = forecast.find((w) => w.date === dateStr);
        const precipExpected = weather ? parseFloat(weather.precipInches) || 0 : 0;
        const highTemp = weather ? parseFloat(weather.highTemp) || 80 : 80;

        // Adjust water need by temperature (higher temps = more evapotranspiration)
        const tempFactor = highTemp > 95 ? 1.3 : highTemp > 85 ? 1.1 : highTemp < 60 ? 0.7 : 1.0;

        // Effective water need = base x temp factor / soil retention
        const effectiveNeed = Math.round((baseNeed * tempFactor / retention) * 100) / 100;

        // Subtract expected precipitation
        const irrigationNeeded = Math.max(0, Math.round((effectiveNeed - precipExpected) * 100) / 100);

        // Total gallons: inches x acreage x 27,154 gallons per acre-inch
        const totalGallons = Math.round(irrigationNeeded * (parseFloat(field.acreage) || 1) * 27154);

        dailySchedule.push({
          date: dateStr,
          effectiveNeedInches: effectiveNeed,
          precipExpectedInches: precipExpected,
          irrigationNeededInches: irrigationNeeded,
          totalGallons,
          highTemp,
          skipDay: irrigationNeeded === 0,
        });
      }

      const totalIrrigationInches = dailySchedule.reduce((s, d) => s + d.irrigationNeededInches, 0);
      const totalGallons = dailySchedule.reduce((s, d) => s + d.totalGallons, 0);
      const skipDays = dailySchedule.filter((d) => d.skipDay).length;

      return {
        fieldId: field.fieldId,
        fieldName: field.name,
        crop: field.crop,
        acreage: field.acreage,
        soilType: field.soilType,
        baseNeedInchesPerDay: baseNeed,
        totalIrrigationInches: Math.round(totalIrrigationInches * 100) / 100,
        totalGallons,
        activeDays: daysAhead - skipDays,
        skipDays,
        schedule: dailySchedule,
      };
    });

    const report = {
      generatedAt: new Date().toISOString(),
      daysAhead,
      fields: schedules,
      totalGallonsAllFields: schedules.reduce((s, f) => s + f.totalGallons, 0),
    };

    artifact.data.waterSchedule = report;

    return { ok: true, result: report };
  });
};
