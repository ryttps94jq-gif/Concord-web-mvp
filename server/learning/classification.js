// learning/classification.js
// DTU Classification System
//
// Every DTU carries a classification field separate from tier.
// Public DTU count = knowledge + seed + mega + hyper
// Everything else is internal infrastructure.

/**
 * Valid DTU classifications.
 */
export const CLASSIFICATIONS = Object.freeze({
  KNOWLEDGE: "knowledge",   // Genuine learned knowledge
  SEED: "seed",             // Original first-order principles
  MEGA: "mega",             // Compound knowledge structures
  HYPER: "hyper",           // Cross-domain compound structures
  SHADOW: "shadow",         // Internal reasoning anchors
  REPAIR: "repair",         // Repair cortex audit logs
  SCAFFOLD: "scaffold",     // Temporary DTUs not promoted
  DEPRECATED: "deprecated", // Retracted or superseded
});

/**
 * Classifications that count in the public total.
 */
export const PUBLIC_CLASSIFICATIONS = Object.freeze([
  CLASSIFICATIONS.KNOWLEDGE,
  CLASSIFICATIONS.SEED,
  CLASSIFICATIONS.MEGA,
  CLASSIFICATIONS.HYPER,
]);

/**
 * Classifications that are internal infrastructure.
 */
export const INTERNAL_CLASSIFICATIONS = Object.freeze([
  CLASSIFICATIONS.SHADOW,
  CLASSIFICATIONS.REPAIR,
  CLASSIFICATIONS.SCAFFOLD,
  CLASSIFICATIONS.DEPRECATED,
]);

/**
 * Determine the classification for a DTU based on its properties.
 *
 * @param {object} dtu - DTU object
 * @returns {string} classification
 */
export function classifyDTU(dtu) {
  if (!dtu) return CLASSIFICATIONS.KNOWLEDGE;

  // Already classified — respect it
  if (dtu.classification && Object.values(CLASSIFICATIONS).includes(dtu.classification)) {
    return dtu.classification;
  }

  // Shadow DTUs
  const tier = (dtu.tier || "").toLowerCase();
  if (tier === "shadow" || (Array.isArray(dtu.tags) && dtu.tags.includes("shadow"))) {
    return CLASSIFICATIONS.SHADOW;
  }

  // Repair cortex DTUs
  if (isRepairDTU(dtu)) {
    return CLASSIFICATIONS.REPAIR;
  }

  // Tier-based classification
  if (tier === "hyper") return CLASSIFICATIONS.HYPER;
  if (tier === "mega") return CLASSIFICATIONS.MEGA;

  // Seed DTUs
  if (dtu.source === "seed" || dtu.source === "bootstrap" || (dtu.authority && dtu.authority.model === "seed")) {
    return CLASSIFICATIONS.SEED;
  }

  // Default: knowledge
  return CLASSIFICATIONS.KNOWLEDGE;
}

/**
 * Check if a DTU was created by the repair cortex.
 */
export function isRepairDTU(dtu) {
  if (!dtu) return false;

  const source = (dtu.source || "").toLowerCase();
  const tags = Array.isArray(dtu.tags) ? dtu.tags : [];
  const meta = dtu.meta || {};

  return (
    source.includes("repair") ||
    tags.includes("repair") ||
    tags.includes("repair_cortex") ||
    meta.createdBy === "repair_cortex" ||
    meta.brainSource === "repair" ||
    source.startsWith("repair.")
  );
}

/**
 * Check if a DTU's classification counts in the public total.
 */
export function isPublicDTU(dtu) {
  const cls = dtu?.classification || classifyDTU(dtu);
  return PUBLIC_CLASSIFICATIONS.includes(cls);
}

/**
 * Apply classification to a DTU (mutates).
 *
 * @param {object} dtu
 * @returns {object} the same dtu with classification field set
 */
export function applyClassification(dtu) {
  if (!dtu) return dtu;
  dtu.classification = classifyDTU(dtu);
  return dtu;
}

/**
 * Migrate existing DTUs — add classification field to all DTUs that lack one.
 *
 * @param {Map} dtus - STATE.dtus map
 * @returns {{ migrated: number, byClassification: object }}
 */
export function migrateClassifications(dtus) {
  const counts = {};
  let migrated = 0;

  for (const dtu of dtus.values()) {
    if (!dtu.classification) {
      dtu.classification = classifyDTU(dtu);
      migrated++;
    }
    counts[dtu.classification] = (counts[dtu.classification] || 0) + 1;
  }

  return { migrated, byClassification: counts };
}

/**
 * Compute substrate stats with proper classification separation.
 *
 * @param {Map} dtus - STATE.dtus map
 * @param {Map} [shadowDtus] - STATE.shadowDtus map (if separate)
 * @returns {object} Structured substrate stats
 */
export function computeSubstrateStats(dtus, shadowDtus = null) {
  const knowledge = { total: 0, seed: 0, regular: 0, mega: 0, hyper: 0 };
  const internal = { shadow: 0, repair: 0, scaffold: 0, deprecated: 0 };

  for (const dtu of dtus.values()) {
    const cls = dtu.classification || classifyDTU(dtu);

    switch (cls) {
      case CLASSIFICATIONS.KNOWLEDGE:
        knowledge.total++;
        knowledge.regular++;
        break;
      case CLASSIFICATIONS.SEED:
        knowledge.total++;
        knowledge.seed++;
        break;
      case CLASSIFICATIONS.MEGA:
        knowledge.total++;
        knowledge.mega++;
        break;
      case CLASSIFICATIONS.HYPER:
        knowledge.total++;
        knowledge.hyper++;
        break;
      case CLASSIFICATIONS.SHADOW:
        internal.shadow++;
        break;
      case CLASSIFICATIONS.REPAIR:
        internal.repair++;
        break;
      case CLASSIFICATIONS.SCAFFOLD:
        internal.scaffold++;
        break;
      case CLASSIFICATIONS.DEPRECATED:
        internal.deprecated++;
        break;
    }
  }

  // Also count separate shadow DTU store if it exists
  if (shadowDtus) {
    for (const dtu of shadowDtus.values()) {
      internal.shadow++;
    }
  }

  const grandTotal = knowledge.total + internal.shadow + internal.repair + internal.scaffold + internal.deprecated;

  return {
    substrate: {
      knowledge,
      internal,
      grand_total: grandTotal,
    },
  };
}
