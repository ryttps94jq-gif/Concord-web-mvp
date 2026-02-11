/**
 * Emergent Agent Governance — Long-Horizon Projects
 *
 * Stage 4: Multi-step projects with dependency planning.
 *
 * The scheduler picks individual work items. Projects add:
 *   - work item graphs (DAGs)
 *   - prerequisites
 *   - staged deliverables
 *   - progress state
 *   - milestone tracking
 *
 * This is how Concord can run "build me a business plan" as a sustained effort
 * without external steering every step.
 *
 * DAG rules:
 *   - No cycles (enforced on edge insertion)
 *   - A work item can only start when all prerequisites are completed
 *   - Projects can be paused, resumed, cancelled
 *   - Progress is computed from completed / total nodes
 *   - Milestones are special nodes that gate downstream work
 */

import { getEmergentState } from "./store.js";
import { createWorkItem, WORK_ITEM_TYPES, ALL_WORK_ITEM_TYPES } from "./scheduler.js";

// ── Project Status ───────────────────────────────────────────────────────────

export const PROJECT_STATUS = Object.freeze({
  DRAFT:       "draft",        // being planned, not yet started
  ACTIVE:      "active",       // in progress
  PAUSED:      "paused",       // temporarily halted
  COMPLETED:   "completed",    // all nodes completed
  CANCELLED:   "cancelled",    // abandoned
  BLOCKED:     "blocked",      // waiting on external input or unresolved blocker
});

// ── Node Status ──────────────────────────────────────────────────────────────

export const NODE_STATUS = Object.freeze({
  PENDING:     "pending",      // not yet ready (prerequisites incomplete)
  READY:       "ready",        // prerequisites met, can be scheduled
  ACTIVE:      "active",       // currently being worked on
  COMPLETED:   "completed",    // done
  SKIPPED:     "skipped",      // bypassed (optional or no longer needed)
  FAILED:      "failed",       // attempted but failed
  BLOCKED:     "blocked",      // cannot proceed
});

// ── Project Store ────────────────────────────────────────────────────────────

/**
 * Get or initialize the project store.
 */
export function getProjectStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._projects) {
    es._projects = {
      projects: new Map(),        // projectId -> Project
      byStatus: new Map(),        // status -> Set<projectId>
      byOwner: new Map(),         // ownerId -> Set<projectId>

      metrics: {
        totalProjects: 0,
        completedProjects: 0,
        cancelledProjects: 0,
        totalNodes: 0,
        completedNodes: 0,
      },
    };
  }
  return es._projects;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PROJECT LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new project.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.name - Project name
 * @param {string} [opts.description] - Project description
 * @param {string} [opts.ownerId] - Who created this project
 * @param {string} [opts.scope] - Domain scope
 * @returns {{ ok: boolean, project?: Object }}
 */
export function createProject(STATE, opts = {}) {
  const store = getProjectStore(STATE);

  if (!opts.name) {
    return { ok: false, error: "name_required" };
  }

  const projectId = `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const project = {
    projectId,
    name: String(opts.name).slice(0, 300),
    description: String(opts.description || "").slice(0, 2000),
    ownerId: opts.ownerId || "system",
    scope: opts.scope || "*",
    status: PROJECT_STATUS.DRAFT,

    // DAG structure
    nodes: new Map(),               // nodeId -> ProjectNode
    edges: [],                      // { from, to } (from must complete before to starts)

    // Milestones
    milestones: [],                 // { nodeId, name, description }

    // Progress
    progress: {
      totalNodes: 0,
      completedNodes: 0,
      failedNodes: 0,
      skippedNodes: 0,
      percentage: 0,
    },

    // Timeline
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    updatedAt: new Date().toISOString(),

    // History
    history: [],
  };

  store.projects.set(projectId, project);
  addToIndex(store.byStatus, project.status, projectId);
  addToIndex(store.byOwner, project.ownerId, projectId);
  store.metrics.totalProjects++;

  return { ok: true, project: serializeProject(project) };
}

/**
 * Add a node (work item) to a project's DAG.
 *
 * @param {Object} STATE - Global server state
 * @param {string} projectId - Project to add to
 * @param {Object} opts
 * @param {string} opts.name - Node name
 * @param {string} [opts.workType] - Type of work item to create when scheduled
 * @param {string[]} [opts.prerequisites] - Node IDs that must complete first
 * @param {boolean} [opts.isMilestone] - Whether this is a milestone node
 * @param {string} [opts.description] - Node description
 * @param {Object} [opts.signals] - Priority signals for the work item
 * @returns {{ ok: boolean, node?: Object }}
 */
export function addNode(STATE, projectId, opts = {}) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "project_not_found" };

  if (project.status !== PROJECT_STATUS.DRAFT && project.status !== PROJECT_STATUS.ACTIVE) {
    return { ok: false, error: "project_not_modifiable", status: project.status };
  }

  if (!opts.name) return { ok: false, error: "name_required" };

  const nodeId = `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Validate prerequisites exist
  const prerequisites = Array.isArray(opts.prerequisites) ? opts.prerequisites : [];
  for (const prereq of prerequisites) {
    if (!project.nodes.has(prereq)) {
      return { ok: false, error: "prerequisite_not_found", nodeId: prereq };
    }
  }

  const node = {
    nodeId,
    projectId,
    name: String(opts.name).slice(0, 300),
    description: String(opts.description || "").slice(0, 1000),
    workType: opts.workType || WORK_ITEM_TYPES.USER_PROMPT,
    signals: opts.signals || {},
    status: NODE_STATUS.PENDING,
    isMilestone: !!opts.isMilestone,
    prerequisites,               // nodeIds that must complete first
    dependents: [],              // nodeIds that depend on this (computed)
    workItemId: null,            // created when node is scheduled
    allocationId: null,
    result: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };

  // Add edges
  for (const prereq of prerequisites) {
    project.edges.push({ from: prereq, to: nodeId });
    // Update dependent list on prerequisite nodes
    const prereqNode = project.nodes.get(prereq);
    if (prereqNode) prereqNode.dependents.push(nodeId);
  }

  // Check for cycles
  if (hasCycle(project, nodeId)) {
    // Rollback
    for (const prereq of prerequisites) {
      const prereqNode = project.nodes.get(prereq);
      if (prereqNode) {
        prereqNode.dependents = prereqNode.dependents.filter(d => d !== nodeId);
      }
    }
    project.edges = project.edges.filter(e => e.to !== nodeId);
    return { ok: false, error: "cycle_detected" };
  }

  project.nodes.set(nodeId, node);
  project.progress.totalNodes++;
  store.metrics.totalNodes++;

  // Add as milestone if flagged
  if (node.isMilestone) {
    project.milestones.push({
      nodeId,
      name: node.name,
      description: node.description,
    });
  }

  updateNodeReadiness(project);
  project.updatedAt = new Date().toISOString();

  return { ok: true, node };
}

/**
 * Start a project (transitions from DRAFT to ACTIVE).
 */
export function startProject(STATE, projectId) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "project_not_found" };

  if (project.status !== PROJECT_STATUS.DRAFT) {
    return { ok: false, error: "can_only_start_draft_projects", status: project.status };
  }

  if (project.nodes.size === 0) {
    return { ok: false, error: "project_has_no_nodes" };
  }

  removeFromIndex(store.byStatus, project.status, projectId);
  project.status = PROJECT_STATUS.ACTIVE;
  project.startedAt = new Date().toISOString();
  project.updatedAt = new Date().toISOString();
  addToIndex(store.byStatus, project.status, projectId);

  updateNodeReadiness(project);

  project.history.push({
    action: "started",
    timestamp: project.startedAt,
  });

  return { ok: true, project: serializeProject(project) };
}

/**
 * Get the next schedulable nodes (READY status) for a project.
 * These can be fed into the scheduler as work items.
 *
 * @param {Object} STATE - Global server state
 * @param {string} projectId - Project to query
 * @returns {{ ok: boolean, readyNodes: Object[] }}
 */
export function getReadyNodes(STATE, projectId) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "project_not_found" };

  const readyNodes = [];
  for (const node of project.nodes.values()) {
    if (node.status === NODE_STATUS.READY) {
      readyNodes.push(node);
    }
  }

  return { ok: true, readyNodes, count: readyNodes.length };
}

/**
 * Schedule ready nodes by creating work items in the scheduler.
 *
 * @param {Object} STATE - Global server state
 * @param {string} projectId - Project to schedule from
 * @param {number} [maxItems=3] - Maximum nodes to schedule at once
 * @returns {{ ok: boolean, scheduled: Object[] }}
 */
export function scheduleReadyNodes(STATE, projectId, maxItems = 3) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "project_not_found" };

  if (project.status !== PROJECT_STATUS.ACTIVE) {
    return { ok: false, error: "project_not_active", status: project.status };
  }

  const scheduled = [];
  let count = 0;

  for (const node of project.nodes.values()) {
    if (count >= maxItems) break;
    if (node.status !== NODE_STATUS.READY) continue;
    if (node.workItemId) continue; // already scheduled

    const result = createWorkItem(STATE, {
      type: ALL_WORK_ITEM_TYPES.includes(node.workType) ? node.workType : WORK_ITEM_TYPES.USER_PROMPT,
      scope: project.scope,
      inputs: [projectId, node.nodeId],
      createdBy: project.ownerId,
      description: `[Project: ${project.name}] ${node.name}`,
      signals: node.signals,
    });

    if (result.ok) {
      node.workItemId = result.item.itemId;
      node.status = NODE_STATUS.ACTIVE;
      node.startedAt = new Date().toISOString();
      scheduled.push({ nodeId: node.nodeId, workItemId: result.item.itemId });
      count++;
    }
  }

  project.updatedAt = new Date().toISOString();
  return { ok: true, scheduled, count: scheduled.length };
}

/**
 * Complete a project node.
 *
 * @param {Object} STATE - Global server state
 * @param {string} projectId - Project ID
 * @param {string} nodeId - Node to complete
 * @param {Object} [result] - Result data
 * @returns {{ ok: boolean, projectCompleted?: boolean }}
 */
export function completeNode(STATE, projectId, nodeId, result = {}) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "project_not_found" };

  const node = project.nodes.get(nodeId);
  if (!node) return { ok: false, error: "node_not_found" };

  if (node.status !== NODE_STATUS.ACTIVE && node.status !== NODE_STATUS.READY) {
    return { ok: false, error: "node_not_completable", status: node.status };
  }

  node.status = NODE_STATUS.COMPLETED;
  node.completedAt = new Date().toISOString();
  node.result = result;
  project.progress.completedNodes++;
  store.metrics.completedNodes++;

  updateNodeReadiness(project);
  updateProgress(project);
  project.updatedAt = new Date().toISOString();

  project.history.push({
    action: "node_completed",
    nodeId,
    timestamp: node.completedAt,
  });

  // Check if project is fully complete
  let projectCompleted = false;
  if (isProjectComplete(project)) {
    removeFromIndex(store.byStatus, project.status, project.projectId);
    project.status = PROJECT_STATUS.COMPLETED;
    project.completedAt = new Date().toISOString();
    addToIndex(store.byStatus, project.status, project.projectId);
    store.metrics.completedProjects++;
    projectCompleted = true;

    project.history.push({
      action: "project_completed",
      timestamp: project.completedAt,
    });
  }

  return { ok: true, projectCompleted, progress: { ...project.progress } };
}

/**
 * Mark a node as failed.
 */
export function failNode(STATE, projectId, nodeId, reason) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "project_not_found" };

  const node = project.nodes.get(nodeId);
  if (!node) return { ok: false, error: "node_not_found" };

  node.status = NODE_STATUS.FAILED;
  node.completedAt = new Date().toISOString();
  node.result = { error: reason || "failed" };
  project.progress.failedNodes++;

  // Block downstream nodes
  blockDependents(project, nodeId);

  updateProgress(project);
  project.updatedAt = new Date().toISOString();

  project.history.push({
    action: "node_failed",
    nodeId,
    reason,
    timestamp: node.completedAt,
  });

  return { ok: true, progress: { ...project.progress } };
}

/**
 * Pause a project.
 */
export function pauseProject(STATE, projectId) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "project_not_found" };

  if (project.status !== PROJECT_STATUS.ACTIVE) {
    return { ok: false, error: "can_only_pause_active_projects" };
  }

  removeFromIndex(store.byStatus, project.status, projectId);
  project.status = PROJECT_STATUS.PAUSED;
  project.updatedAt = new Date().toISOString();
  addToIndex(store.byStatus, project.status, projectId);

  project.history.push({ action: "paused", timestamp: project.updatedAt });

  return { ok: true, project: serializeProject(project) };
}

/**
 * Resume a paused project.
 */
export function resumeProject(STATE, projectId) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "project_not_found" };

  if (project.status !== PROJECT_STATUS.PAUSED) {
    return { ok: false, error: "can_only_resume_paused_projects" };
  }

  removeFromIndex(store.byStatus, project.status, projectId);
  project.status = PROJECT_STATUS.ACTIVE;
  project.updatedAt = new Date().toISOString();
  addToIndex(store.byStatus, project.status, projectId);

  project.history.push({ action: "resumed", timestamp: project.updatedAt });

  return { ok: true, project: serializeProject(project) };
}

/**
 * Cancel a project.
 */
export function cancelProject(STATE, projectId, reason) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "project_not_found" };

  if (project.status === PROJECT_STATUS.COMPLETED || project.status === PROJECT_STATUS.CANCELLED) {
    return { ok: false, error: "project_already_terminal", status: project.status };
  }

  removeFromIndex(store.byStatus, project.status, projectId);
  project.status = PROJECT_STATUS.CANCELLED;
  project.updatedAt = new Date().toISOString();
  addToIndex(store.byStatus, project.status, projectId);
  store.metrics.cancelledProjects++;

  project.history.push({ action: "cancelled", reason, timestamp: project.updatedAt });

  return { ok: true, project: serializeProject(project) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. QUERY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a project by ID.
 */
export function getProject(STATE, projectId) {
  const store = getProjectStore(STATE);
  const project = store.projects.get(projectId);
  if (!project) return { ok: false, error: "not_found" };
  return { ok: true, project: serializeProject(project) };
}

/**
 * List projects with optional filters.
 */
export function listProjects(STATE, filters = {}) {
  const store = getProjectStore(STATE);
  let results = Array.from(store.projects.values());

  if (filters.status) results = results.filter(p => p.status === filters.status);
  if (filters.ownerId) results = results.filter(p => p.ownerId === filters.ownerId);
  if (filters.scope) results = results.filter(p => p.scope === "*" || p.scope === filters.scope);

  return { ok: true, projects: results.map(serializeProject), count: results.length };
}

/**
 * Get project metrics.
 */
export function getProjectMetrics(STATE) {
  const store = getProjectStore(STATE);
  return { ok: true, metrics: { ...store.metrics } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DFS cycle detection. Returns true if adding nodeId creates a cycle.
 */
function hasCycle(project, startNodeId) {
  const visited = new Set();
  const stack = new Set();

  function dfs(nodeId) {
    if (stack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    stack.add(nodeId);

    const node = project.nodes.get(nodeId);
    if (node) {
      for (const dep of node.dependents) {
        if (dfs(dep)) return true;
      }
    }

    stack.delete(nodeId);
    return false;
  }

  return dfs(startNodeId);
}

/**
 * Update node readiness: nodes whose prerequisites are all completed become READY.
 */
function updateNodeReadiness(project) {
  for (const node of project.nodes.values()) {
    if (node.status !== NODE_STATUS.PENDING) continue;

    const allPrereqsMet = node.prerequisites.every(prereqId => {
      const prereq = project.nodes.get(prereqId);
      return prereq && (prereq.status === NODE_STATUS.COMPLETED || prereq.status === NODE_STATUS.SKIPPED);
    });

    if (allPrereqsMet) {
      node.status = NODE_STATUS.READY;
    }
  }
}

/**
 * Block all dependents of a failed node.
 */
function blockDependents(project, failedNodeId) {
  const node = project.nodes.get(failedNodeId);
  if (!node) return;

  for (const depId of node.dependents) {
    const dep = project.nodes.get(depId);
    if (dep && dep.status === NODE_STATUS.PENDING) {
      dep.status = NODE_STATUS.BLOCKED;
      blockDependents(project, depId); // cascade
    }
  }
}

/**
 * Update project progress percentages.
 */
function updateProgress(project) {
  const total = project.progress.totalNodes;
  if (total === 0) {
    project.progress.percentage = 0;
    return;
  }
  const done = project.progress.completedNodes + project.progress.skippedNodes;
  project.progress.percentage = Math.round((done / total) * 100);
}

/**
 * Check if a project is complete (all non-skipped nodes are completed/skipped).
 */
function isProjectComplete(project) {
  for (const node of project.nodes.values()) {
    if (node.status !== NODE_STATUS.COMPLETED &&
        node.status !== NODE_STATUS.SKIPPED) {
      return false;
    }
  }
  return project.nodes.size > 0;
}

/**
 * Serialize a project for API output (convert Maps to objects).
 */
function serializeProject(project) {
  return {
    ...project,
    nodes: Array.from(project.nodes.values()),
    nodeCount: project.nodes.size,
  };
}

function addToIndex(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function removeFromIndex(map, key, value) {
  const set = map.get(key);
  if (set) set.delete(value);
}
