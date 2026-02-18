/**
 * Concord — Collaboration System
 *
 * Shared workspaces, multi-author DTU editing, comment threads,
 * and "propose revision" flow for collaborative knowledge building.
 */

import crypto from "crypto";

// ── Collaboration State ──────────────────────────────────────────────────

function getCollabState(STATE) {
  if (!STATE._collab) {
    STATE._collab = {
      workspaces: new Map(),      // workspaceId → workspace
      memberships: new Map(),     // userId → Set<workspaceId>
      comments: new Map(),        // dtuId → comment thread
      revisionProposals: new Map(), // proposalId → revision proposal
      editSessions: new Map(),    // dtuId → active edit session

      metrics: {
        totalWorkspaces: 0,
        totalComments: 0,
        totalRevisions: 0,
        activeEditSessions: 0,
      },
    };
  }
  return STATE._collab;
}

// ── Shared Workspaces ────────────────────────────────────────────────────

/**
 * Create a shared workspace where multiple users can collaborate.
 */
export function createWorkspace(STATE, input) {
  const collab = getCollabState(STATE);

  const workspace = {
    id: `ws_${crypto.randomBytes(6).toString("hex")}`,
    name: input.name || "New Workspace",
    description: input.description || "",
    ownerId: input.ownerId,
    members: [{
      userId: input.ownerId,
      role: "owner",
      joinedAt: new Date().toISOString(),
    }],
    dtus: new Set(),             // DTU IDs in this workspace
    visibility: input.visibility || "private", // private, org, public
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      allowMemberInvite: input.settings?.allowMemberInvite ?? true,
      requireApprovalForEdits: input.settings?.requireApprovalForEdits ?? false,
      maxMembers: input.settings?.maxMembers || 50,
    },
  };

  collab.workspaces.set(workspace.id, workspace);

  // Index membership
  if (!collab.memberships.has(input.ownerId)) collab.memberships.set(input.ownerId, new Set());
  collab.memberships.get(input.ownerId).add(workspace.id);

  collab.metrics.totalWorkspaces++;

  return { ok: true, workspace };
}

export function getWorkspace(STATE, workspaceId) {
  const collab = getCollabState(STATE);
  const ws = collab.workspaces.get(workspaceId);
  if (!ws) return { ok: false, error: "Workspace not found" };
  return { ok: true, workspace: { ...ws, dtus: Array.from(ws.dtus), memberCount: ws.members.length } };
}

export function listWorkspaces(STATE, userId) {
  const collab = getCollabState(STATE);
  const wsIds = collab.memberships.get(userId) || new Set();
  const workspaces = Array.from(wsIds).map(id => {
    const ws = collab.workspaces.get(id);
    if (!ws) return null;
    return {
      id: ws.id,
      name: ws.name,
      description: ws.description,
      memberCount: ws.members.length,
      dtuCount: ws.dtus.size,
      role: ws.members.find(m => m.userId === userId)?.role || "viewer",
      visibility: ws.visibility,
      updatedAt: ws.updatedAt,
    };
  }).filter(Boolean);

  return { ok: true, workspaces, total: workspaces.length };
}

/**
 * Add a member to a workspace.
 */
export function addWorkspaceMember(STATE, workspaceId, userId, role = "editor", invitedBy) {
  const collab = getCollabState(STATE);
  const ws = collab.workspaces.get(workspaceId);
  if (!ws) return { ok: false, error: "Workspace not found" };

  if (ws.members.length >= ws.settings.maxMembers) {
    return { ok: false, error: "Workspace member limit reached" };
  }

  const existing = ws.members.find(m => m.userId === userId);
  if (existing) return { ok: false, error: "User already a member" };

  const validRoles = ["viewer", "editor", "admin", "owner"];
  if (!validRoles.includes(role)) return { ok: false, error: "Invalid role" };

  ws.members.push({
    userId,
    role,
    joinedAt: new Date().toISOString(),
    invitedBy: invitedBy || null,
  });

  if (!collab.memberships.has(userId)) collab.memberships.set(userId, new Set());
  collab.memberships.get(userId).add(workspaceId);

  ws.updatedAt = new Date().toISOString();

  return { ok: true, workspaceId, userId, role };
}

export function removeWorkspaceMember(STATE, workspaceId, userId) {
  const collab = getCollabState(STATE);
  const ws = collab.workspaces.get(workspaceId);
  if (!ws) return { ok: false, error: "Workspace not found" };

  const idx = ws.members.findIndex(m => m.userId === userId);
  if (idx < 0) return { ok: false, error: "User not a member" };
  if (ws.members[idx].role === "owner") return { ok: false, error: "Cannot remove workspace owner" };

  ws.members.splice(idx, 1);
  collab.memberships.get(userId)?.delete(workspaceId);
  ws.updatedAt = new Date().toISOString();

  return { ok: true, workspaceId, userId };
}

/**
 * Add a DTU to a workspace.
 */
export function addDtuToWorkspace(STATE, workspaceId, dtuId) {
  const collab = getCollabState(STATE);
  const ws = collab.workspaces.get(workspaceId);
  if (!ws) return { ok: false, error: "Workspace not found" };

  ws.dtus.add(dtuId);
  ws.updatedAt = new Date().toISOString();

  return { ok: true, workspaceId, dtuId };
}

// ── Comment Threads on DTUs ──────────────────────────────────────────────

/**
 * Add a comment to a DTU's discussion thread.
 */
export function addComment(STATE, dtuId, userId, text, parentCommentId = null) {
  const collab = getCollabState(STATE);

  if (!text || text.trim().length === 0) return { ok: false, error: "Comment text required" };
  if (text.length > 5000) return { ok: false, error: "Comment too long (max 5000 chars)" };

  if (!collab.comments.has(dtuId)) {
    collab.comments.set(dtuId, {
      dtuId,
      comments: [],
      commentCount: 0,
    });
  }

  const thread = collab.comments.get(dtuId);

  // Validate parent exists if replying
  if (parentCommentId) {
    const parent = thread.comments.find(c => c.id === parentCommentId);
    if (!parent) return { ok: false, error: "Parent comment not found" };
  }

  const comment = {
    id: `cmt_${crypto.randomBytes(6).toString("hex")}`,
    dtuId,
    userId,
    text: text.trim(),
    parentCommentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reactions: {},       // emoji → count
    isResolved: false,
    editHistory: [],
  };

  thread.comments.push(comment);
  thread.commentCount++;
  collab.metrics.totalComments++;

  return { ok: true, comment };
}

export function getComments(STATE, dtuId, options = {}) {
  const collab = getCollabState(STATE);
  const thread = collab.comments.get(dtuId);
  if (!thread) return { ok: true, dtuId, comments: [], total: 0 };

  const comments = thread.comments;

  // Build tree structure if requested
  if (options.tree) {
    const roots = comments.filter(c => !c.parentCommentId);
    const children = new Map();
    for (const c of comments) {
      if (c.parentCommentId) {
        if (!children.has(c.parentCommentId)) children.set(c.parentCommentId, []);
        children.get(c.parentCommentId).push(c);
      }
    }

    function buildTree(comment) {
      return {
        ...comment,
        replies: (children.get(comment.id) || []).map(buildTree),
      };
    }

    return { ok: true, dtuId, comments: roots.map(buildTree), total: thread.commentCount };
  }

  // Flat list, sorted by date
  comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const limit = options.limit || 50;
  return { ok: true, dtuId, comments: comments.slice(0, limit), total: thread.commentCount };
}

export function editComment(STATE, commentId, userId, newText) {
  const collab = getCollabState(STATE);

  for (const thread of collab.comments.values()) {
    const comment = thread.comments.find(c => c.id === commentId);
    if (comment) {
      if (comment.userId !== userId) return { ok: false, error: "Not your comment" };
      comment.editHistory.push({ text: comment.text, editedAt: comment.updatedAt });
      comment.text = newText.trim();
      comment.updatedAt = new Date().toISOString();
      return { ok: true, comment };
    }
  }
  return { ok: false, error: "Comment not found" };
}

export function resolveComment(STATE, commentId) {
  const collab = getCollabState(STATE);
  for (const thread of collab.comments.values()) {
    const comment = thread.comments.find(c => c.id === commentId);
    if (comment) {
      comment.isResolved = true;
      comment.updatedAt = new Date().toISOString();
      return { ok: true, comment };
    }
  }
  return { ok: false, error: "Comment not found" };
}

// ── Revision Proposals ───────────────────────────────────────────────────

/**
 * Propose a revision to an existing DTU (like a PR for knowledge).
 */
export function proposeRevision(STATE, dtuId, userId, changes, reason) {
  const collab = getCollabState(STATE);

  if (!changes || Object.keys(changes).length === 0) {
    return { ok: false, error: "No changes specified" };
  }

  const proposal = {
    id: `rev_${crypto.randomBytes(6).toString("hex")}`,
    dtuId,
    proposerId: userId,
    changes, // { title?, content?, tags?, claims? }
    reason: reason || "",
    status: "PENDING", // PENDING, APPROVED, REJECTED, WITHDRAWN
    votes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };

  collab.revisionProposals.set(proposal.id, proposal);
  collab.metrics.totalRevisions++;

  return { ok: true, proposal };
}

export function getRevisionProposals(STATE, dtuId, status = null) {
  const collab = getCollabState(STATE);
  let proposals = Array.from(collab.revisionProposals.values()).filter(p => p.dtuId === dtuId);

  if (status) {
    proposals = proposals.filter(p => p.status === status);
  }

  proposals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { ok: true, dtuId, proposals, total: proposals.length };
}

export function voteOnRevision(STATE, proposalId, userId, vote) {
  const collab = getCollabState(STATE);
  const proposal = collab.revisionProposals.get(proposalId);
  if (!proposal) return { ok: false, error: "Proposal not found" };
  if (proposal.status !== "PENDING") return { ok: false, error: "Proposal is not pending" };

  // Remove existing vote from this user
  proposal.votes = proposal.votes.filter(v => v.userId !== userId);

  proposal.votes.push({
    userId,
    vote: vote === "approve" ? "approve" : "reject",
    votedAt: new Date().toISOString(),
  });

  proposal.updatedAt = new Date().toISOString();

  // Auto-resolve if threshold met (3 approvals or 3 rejections)
  const approvals = proposal.votes.filter(v => v.vote === "approve").length;
  const rejections = proposal.votes.filter(v => v.vote === "reject").length;

  if (approvals >= 3) {
    proposal.status = "APPROVED";
    proposal.resolvedAt = new Date().toISOString();
    proposal.resolvedBy = "auto_threshold";
  } else if (rejections >= 3) {
    proposal.status = "REJECTED";
    proposal.resolvedAt = new Date().toISOString();
    proposal.resolvedBy = "auto_threshold";
  }

  return {
    ok: true,
    proposal,
    approvals,
    rejections,
  };
}

/**
 * Apply an approved revision to a DTU.
 */
export function applyRevision(STATE, proposalId, appliedBy) {
  const collab = getCollabState(STATE);
  const proposal = collab.revisionProposals.get(proposalId);
  if (!proposal) return { ok: false, error: "Proposal not found" };
  if (proposal.status !== "APPROVED") return { ok: false, error: "Proposal not approved" };

  const dtu = STATE.dtus?.get(proposal.dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };

  // Apply changes
  const applied = [];
  if (proposal.changes.title !== undefined) {
    dtu.title = proposal.changes.title;
    if (dtu.human) dtu.human.title = proposal.changes.title;
    applied.push("title");
  }
  if (proposal.changes.content !== undefined) {
    if (dtu.human) dtu.human.summary = proposal.changes.content;
    applied.push("content");
  }
  if (proposal.changes.tags !== undefined) {
    dtu.tags = proposal.changes.tags;
    applied.push("tags");
  }

  dtu.updatedAt = new Date().toISOString();
  if (dtu.meta) dtu.meta.updatedAt = dtu.updatedAt;

  proposal.status = "APPLIED";
  proposal.resolvedAt = new Date().toISOString();
  proposal.resolvedBy = appliedBy;

  return { ok: true, dtuId: proposal.dtuId, applied, proposal };
}

// ── Multi-Author Edit Sessions ───────────────────────────────────────────

/**
 * Start a collaborative edit session on a DTU.
 */
export function startEditSession(STATE, dtuId, userId) {
  const collab = getCollabState(STATE);

  const existing = collab.editSessions.get(dtuId);
  if (existing && existing.active) {
    // Join existing session
    if (!existing.participants.includes(userId)) {
      existing.participants.push(userId);
    }
    return { ok: true, session: existing, joined: true };
  }

  const session = {
    dtuId,
    startedBy: userId,
    participants: [userId],
    active: true,
    startedAt: new Date().toISOString(),
    edits: [],           // { userId, field, oldValue, newValue, ts }
    lastActivity: new Date().toISOString(),
  };

  collab.editSessions.set(dtuId, session);
  collab.metrics.activeEditSessions++;

  return { ok: true, session, joined: false };
}

export function recordEdit(STATE, dtuId, userId, field, oldValue, newValue) {
  const collab = getCollabState(STATE);
  const session = collab.editSessions.get(dtuId);
  if (!session || !session.active) return { ok: false, error: "No active edit session" };

  session.edits.push({
    userId,
    field,
    oldValue,
    newValue,
    ts: new Date().toISOString(),
  });
  session.lastActivity = new Date().toISOString();

  return { ok: true, editCount: session.edits.length };
}

export function endEditSession(STATE, dtuId) {
  const collab = getCollabState(STATE);
  const session = collab.editSessions.get(dtuId);
  if (!session) return { ok: false, error: "No edit session" };

  session.active = false;
  session.endedAt = new Date().toISOString();
  collab.metrics.activeEditSessions = Math.max(0, collab.metrics.activeEditSessions - 1);

  return { ok: true, session };
}

// ── Metrics ──────────────────────────────────────────────────────────────

export function getCollabMetrics(STATE) {
  const collab = getCollabState(STATE);
  return { ok: true, ...collab.metrics };
}
