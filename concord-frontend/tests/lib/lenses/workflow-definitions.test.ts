import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_DEFINITIONS,
  getWorkflowsForDomain,
  getWorkflow,
  getAvailableTransitions,
  isValidTransition,
  getInitialState,
  getDomainsWithWorkflows,
} from '@/lib/lenses/workflow-definitions';
import type { WorkflowDef, WorkflowState, WorkflowTransition } from '@/lib/lenses/workflow-definitions';

describe('WORKFLOW_DEFINITIONS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(WORKFLOW_DEFINITIONS)).toBe(true);
    expect(WORKFLOW_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('every workflow has required fields', () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      expect(typeof wf.domain).toBe('string');
      expect(wf.domain.length).toBeGreaterThan(0);
      expect(typeof wf.entity).toBe('string');
      expect(wf.entity.length).toBeGreaterThan(0);
      expect(Array.isArray(wf.states)).toBe(true);
      expect(wf.states.length).toBeGreaterThan(0);
      expect(Array.isArray(wf.transitions)).toBe(true);
      expect(wf.transitions.length).toBeGreaterThan(0);
    }
  });

  it('every state has name and label', () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      for (const state of wf.states) {
        expect(typeof state.name).toBe('string');
        expect(typeof state.label).toBe('string');
      }
    }
  });

  it('every workflow has exactly one initial state', () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      const initialStates = wf.states.filter(s => s.initial);
      expect(initialStates.length).toBe(1);
    }
  });

  it('every workflow has at least one terminal state', () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      const terminalStates = wf.states.filter(s => s.terminal);
      expect(terminalStates.length).toBeGreaterThan(0);
    }
  });

  it('every transition references valid states', () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      const stateNames = new Set(wf.states.map(s => s.name));
      for (const t of wf.transitions) {
        expect(stateNames.has(t.from)).toBe(true);
        expect(stateNames.has(t.to)).toBe(true);
      }
    }
  });

  it('every transition has from, to, action, and label', () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      for (const t of wf.transitions) {
        expect(typeof t.from).toBe('string');
        expect(typeof t.to).toBe('string');
        expect(typeof t.action).toBe('string');
        expect(typeof t.label).toBe('string');
      }
    }
  });

  it('includes core domain workflows', () => {
    const domains = WORKFLOW_DEFINITIONS.map(w => w.domain);
    expect(domains).toContain('paper');
    expect(domains).toContain('code');
    expect(domains).toContain('healthcare');
  });
});

describe('getWorkflowsForDomain', () => {
  it('returns workflows for paper domain', () => {
    const workflows = getWorkflowsForDomain('paper');
    expect(workflows.length).toBeGreaterThan(0);
    expect(workflows[0].domain).toBe('paper');
    expect(workflows[0].entity).toBe('project');
  });

  it('returns multiple workflows for healthcare domain', () => {
    const workflows = getWorkflowsForDomain('healthcare');
    expect(workflows.length).toBeGreaterThanOrEqual(2);
    const entities = workflows.map(w => w.entity);
    expect(entities).toContain('Encounter');
    expect(entities).toContain('Prescription');
  });

  it('returns multiple workflows for legal domain', () => {
    const workflows = getWorkflowsForDomain('legal');
    expect(workflows.length).toBeGreaterThanOrEqual(2);
    const entities = workflows.map(w => w.entity);
    expect(entities).toContain('Case');
    expect(entities).toContain('Contract');
  });

  it('returns empty array for unknown domain', () => {
    const workflows = getWorkflowsForDomain('nonexistent');
    expect(workflows).toEqual([]);
  });
});

describe('getWorkflow', () => {
  it('returns specific workflow for paper/project', () => {
    const wf = getWorkflow('paper', 'project');
    expect(wf).toBeDefined();
    expect(wf!.domain).toBe('paper');
    expect(wf!.entity).toBe('project');
  });

  it('returns specific workflow for healthcare/Encounter', () => {
    const wf = getWorkflow('healthcare', 'Encounter');
    expect(wf).toBeDefined();
    expect(wf!.entity).toBe('Encounter');
  });

  it('returns specific workflow for code/review', () => {
    const wf = getWorkflow('code', 'review');
    expect(wf).toBeDefined();
    expect(wf!.entity).toBe('review');
  });

  it('returns undefined for unknown domain', () => {
    expect(getWorkflow('nonexistent', 'project')).toBeUndefined();
  });

  it('returns undefined for unknown entity', () => {
    expect(getWorkflow('paper', 'nonexistent')).toBeUndefined();
  });
});

describe('getAvailableTransitions', () => {
  it('returns transitions from draft state for paper/project', () => {
    const transitions = getAvailableTransitions('paper', 'project', 'draft', 'editor');
    expect(transitions.length).toBeGreaterThan(0);
    const actions = transitions.map(t => t.action);
    expect(actions).toContain('submit');
  });

  it('returns no transitions for viewer role on paper/project from draft', () => {
    const transitions = getAvailableTransitions('paper', 'project', 'draft', 'viewer');
    // 'submit' requires 'editor' role, viewer has lower rank
    expect(transitions.length).toBe(0);
  });

  it('returns transitions for admin role (higher than required)', () => {
    const transitions = getAvailableTransitions('paper', 'project', 'draft', 'admin');
    expect(transitions.length).toBeGreaterThan(0);
  });

  it('returns transitions for owner role (highest)', () => {
    const transitions = getAvailableTransitions('paper', 'project', 'draft', 'owner');
    expect(transitions.length).toBeGreaterThan(0);
  });

  it('returns empty for unknown domain', () => {
    const transitions = getAvailableTransitions('nonexistent', 'project', 'draft', 'admin');
    expect(transitions).toEqual([]);
  });

  it('returns empty for terminal state', () => {
    const transitions = getAvailableTransitions('paper', 'project', 'archived', 'admin');
    expect(transitions).toEqual([]);
  });

  it('filters transitions by current state', () => {
    const transitions = getAvailableTransitions('paper', 'project', 'in_review', 'admin');
    for (const t of transitions) {
      expect(t.from).toBe('in_review');
    }
  });

  it('returns correct transitions for healthcare encounter', () => {
    const transitions = getAvailableTransitions('healthcare', 'Encounter', 'scheduled', 'editor');
    expect(transitions.length).toBeGreaterThan(0);
    const actions = transitions.map(t => t.action);
    expect(actions).toContain('check_in');
    expect(actions).toContain('cancel');
    expect(actions).toContain('mark_no_show');
  });

  it('respects role hierarchy for reviewer', () => {
    // Reviewer should be able to do editor-level actions
    const transitions = getAvailableTransitions('paper', 'project', 'in_review', 'reviewer');
    const actions = transitions.map(t => t.action);
    expect(actions).toContain('request_changes');
  });
});

describe('isValidTransition', () => {
  it('returns true for valid transition', () => {
    expect(isValidTransition('paper', 'project', 'draft', 'in_review')).toBe(true);
  });

  it('returns true for in_review to published', () => {
    expect(isValidTransition('paper', 'project', 'in_review', 'published')).toBe(true);
  });

  it('returns false for invalid transition', () => {
    expect(isValidTransition('paper', 'project', 'draft', 'published')).toBe(false);
  });

  it('returns false for unknown domain', () => {
    expect(isValidTransition('nonexistent', 'project', 'draft', 'in_review')).toBe(false);
  });

  it('returns false for unknown entity', () => {
    expect(isValidTransition('paper', 'nonexistent', 'draft', 'in_review')).toBe(false);
  });

  it('returns false for reversed transition that does not exist', () => {
    expect(isValidTransition('paper', 'project', 'published', 'draft')).toBe(false);
  });

  it('validates code review transitions', () => {
    expect(isValidTransition('code', 'review', 'open', 'approved')).toBe(true);
    expect(isValidTransition('code', 'review', 'approved', 'merged')).toBe(true);
    expect(isValidTransition('code', 'review', 'open', 'merged')).toBe(false);
  });
});

describe('getInitialState', () => {
  it('returns draft for paper/project', () => {
    expect(getInitialState('paper', 'project')).toBe('draft');
  });

  it('returns open for code/review', () => {
    expect(getInitialState('code', 'review')).toBe('open');
  });

  it('returns scheduled for healthcare/Encounter', () => {
    expect(getInitialState('healthcare', 'Encounter')).toBe('scheduled');
  });

  it('returns active for healthcare/Prescription', () => {
    expect(getInitialState('healthcare', 'Prescription')).toBe('active');
  });

  it('returns filed for insurance/Claim', () => {
    expect(getInitialState('insurance', 'Claim')).toBe('filed');
  });

  it('returns undefined for unknown domain', () => {
    expect(getInitialState('nonexistent', 'project')).toBeUndefined();
  });

  it('returns undefined for unknown entity', () => {
    expect(getInitialState('paper', 'nonexistent')).toBeUndefined();
  });
});

describe('getDomainsWithWorkflows', () => {
  it('returns array of strings', () => {
    const domains = getDomainsWithWorkflows();
    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBeGreaterThan(0);
    for (const d of domains) {
      expect(typeof d).toBe('string');
    }
  });

  it('contains known domains', () => {
    const domains = getDomainsWithWorkflows();
    expect(domains).toContain('paper');
    expect(domains).toContain('code');
    expect(domains).toContain('healthcare');
    expect(domains).toContain('legal');
    expect(domains).toContain('accounting');
  });

  it('each returned domain has at least one workflow', () => {
    const domains = getDomainsWithWorkflows();
    for (const d of domains) {
      const workflows = getWorkflowsForDomain(d);
      expect(workflows.length).toBeGreaterThan(0);
    }
  });
});
