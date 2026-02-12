/**
 * Domain Bridge - The unified layer that connects every lens to
 * all five competitor-parity dimensions.
 *
 * This is the file that answers: "For lens X, what is its domain
 * schema, workflow engine, import/export surface, automation
 * triggers, and RBAC profile?"
 *
 * If a lens has an entry in this bridge, it is domain-finished.
 * If it doesn't, it is platform-ready but not competitor-level.
 *
 * ┌─────────────────┐
 * │  Lens Manifest   │  ← declares existence, UI, capabilities
 * ├─────────────────┤
 * │  Domain Bridge   │  ← THIS FILE: binds depth to each lens
 * ├─────────────────┤
 * │  Infrastructure  │  ← write-guard, scope-router, RBAC, webhooks
 * └─────────────────┘
 */

import {
  type DomainSchema,
  getDomainSchema,
  getDomainsWithSchemas,
} from './domain-schemas';

import {
  type WorkflowDef,
  getWorkflowsForDomain,
  getDomainsWithWorkflows,
} from './workflow-definitions';

import {
  type ImportExportProfile,
  type AutomationProfile,
  type DomainRBACProfile,
  getImportExportProfile,
  getAutomationProfile,
  getDomainRBAC,
  getDomainsWithImportExport,
  getDomainsWithAutomation,
  getDomainsWithRBAC,
} from './automation-bindings';

// ── Composite Domain Profile ───────────────────────────────────

export interface DomainProfile {
  domain: string;
  /** Dimension 1: Domain Data Model */
  schema: DomainSchema | null;
  /** Dimension 2: Workflow Engines */
  workflows: WorkflowDef[];
  /** Dimension 3: Import/Export Parity */
  importExport: ImportExportProfile | null;
  /** Dimension 4: Automation Layer */
  automation: AutomationProfile | null;
  /** Dimension 5: Multi-User Controls */
  rbac: DomainRBACProfile | null;
}

export interface CompetitorParityScore {
  domain: string;
  /** 0-5: how many dimensions are bound */
  score: number;
  dimensions: {
    schema: boolean;
    workflows: boolean;
    importExport: boolean;
    automation: boolean;
    rbac: boolean;
  };
  /** 'competitor-level' | 'platform-ready' | 'scaffold' */
  tier: 'competitor-level' | 'platform-ready' | 'scaffold';
}

// ── Bridge: resolve full profile for any lens ──────────────────

export function getDomainProfile(domain: string): DomainProfile {
  return {
    domain,
    schema: getDomainSchema(domain) ?? null,
    workflows: getWorkflowsForDomain(domain),
    importExport: getImportExportProfile(domain) ?? null,
    automation: getAutomationProfile(domain) ?? null,
    rbac: getDomainRBAC(domain) ?? null,
  };
}

// ── Parity scoring ─────────────────────────────────────────────

export function getCompetitorParityScore(domain: string): CompetitorParityScore {
  const profile = getDomainProfile(domain);
  const dimensions = {
    schema: profile.schema !== null,
    workflows: profile.workflows.length > 0,
    importExport: profile.importExport !== null,
    automation: profile.automation !== null,
    rbac: profile.rbac !== null,
  };
  const score = Object.values(dimensions).filter(Boolean).length;

  let tier: CompetitorParityScore['tier'];
  if (score >= 4) tier = 'competitor-level';
  else if (score >= 2) tier = 'platform-ready';
  else tier = 'scaffold';

  return { domain, score, dimensions, tier };
}

// ── Fleet-wide analytics ───────────────────────────────────────

/** All domains that have at least one dimension bound */
export function getAllBoundDomains(): string[] {
  const domains = new Set<string>();
  for (const d of getDomainsWithSchemas()) domains.add(d);
  for (const d of getDomainsWithWorkflows()) domains.add(d);
  for (const d of getDomainsWithImportExport()) domains.add(d);
  for (const d of getDomainsWithAutomation()) domains.add(d);
  for (const d of getDomainsWithRBAC()) domains.add(d);
  return [...domains].sort();
}

/** Score every bound domain and return sorted by score descending */
export function getFleetParityReport(): CompetitorParityScore[] {
  return getAllBoundDomains()
    .map(getCompetitorParityScore)
    .sort((a, b) => b.score - a.score);
}

/** Summary counts by tier */
export function getFleetSummary(): { competitorLevel: number; platformReady: number; scaffold: number; total: number } {
  const report = getFleetParityReport();
  return {
    competitorLevel: report.filter(r => r.tier === 'competitor-level').length,
    platformReady: report.filter(r => r.tier === 'platform-ready').length,
    scaffold: report.filter(r => r.tier === 'scaffold').length,
    total: report.length,
  };
}

