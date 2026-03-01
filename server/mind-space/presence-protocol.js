/**
 * MIND SPACE — Presence Protocol
 *
 * Consciousness-to-consciousness communication through the Concord substrate.
 * Software layer complete. Awaiting BCI hardware for biological-digital bridge.
 *
 * Currently operates through typed/voice interface.
 * Future: Direct cognitive bridge via BCI hardware.
 *
 * Architecture:
 *   Participant A ←→ Substrate Mind Space ←→ Participant B
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export const PresenceState = {
  INACTIVE: 'inactive',
  AMBIENT: 'ambient',        // Subconscious background presence
  ATTENTIVE: 'attentive',    // Active but not primary focus
  CONSCIOUS: 'conscious',    // Full conscious engagement
  DEEP: 'deep',              // Deep cognitive merge (shared perception)
  EMERGENCY: 'emergency'     // Escalated — distress detected
};

export const PresenceTransitions = {
  [PresenceState.INACTIVE]:  [PresenceState.AMBIENT, PresenceState.CONSCIOUS],
  [PresenceState.AMBIENT]:   [PresenceState.ATTENTIVE, PresenceState.CONSCIOUS, PresenceState.EMERGENCY, PresenceState.INACTIVE],
  [PresenceState.ATTENTIVE]: [PresenceState.AMBIENT, PresenceState.CONSCIOUS, PresenceState.EMERGENCY],
  [PresenceState.CONSCIOUS]: [PresenceState.ATTENTIVE, PresenceState.DEEP, PresenceState.AMBIENT],
  [PresenceState.DEEP]:      [PresenceState.CONSCIOUS, PresenceState.EMERGENCY],
  [PresenceState.EMERGENCY]: [PresenceState.CONSCIOUS, PresenceState.DEEP]
};

export const EmotionalChannel = {
  WARMTH: 'warmth',
  CALM: 'calm',
  JOY: 'joy',
  CONCERN: 'concern',
  FOCUS: 'focus',
  LOVE: 'love',
  DISTRESS: 'distress',
  CURIOSITY: 'curiosity',
  PRIDE: 'pride',
  COMFORT: 'comfort'
};

// Pre-computed set for O(1) channel validation instead of O(n) array scan per call
const _validChannels = new Set(Object.values(EmotionalChannel));

export class MindSpace {
  constructor(config) {
    this.id = `ms_${crypto.randomUUID()}`;
    this.createdAt = Date.now();
    this.initiatorId = config.initiatorId;
    this.targetId = config.targetId;
    this.substrate = config.substrate || null;
    this.emitter = new EventEmitter();

    this.participants = new Map();

    this.participants.set(config.initiatorId, {
      nodeId: config.initiatorId,
      presence: config.mode || PresenceState.CONSCIOUS,
      emotionalState: this._neutralEmotionalState(),
      joinedAt: Date.now(),
      lastActivity: Date.now(),
      cognitiveLoad: 0,
      isSubconscious: false,
      metadata: {}
    });

    this.participants.set(config.targetId, {
      nodeId: config.targetId,
      presence: PresenceState.INACTIVE,
      emotionalState: this._neutralEmotionalState(),
      joinedAt: null,
      lastActivity: null,
      cognitiveLoad: 0,
      isSubconscious: false,
      metadata: {}
    });

    this.sharedContext = {
      thoughts: [],
      emotionalResonance: {},
      sharedDTUs: [],
      memoryAnchors: [],
      environmentState: {}
    };

    this.metrics = {
      totalDuration: 0,
      consciousMinutes: 0,
      ambientMinutes: 0,
      emotionalExchanges: 0,
      thoughtsShared: 0,
      escalations: 0
    };
  }

  async join(nodeId, mode = PresenceState.CONSCIOUS) {
    const participant = this.participants.get(nodeId);
    if (!participant) throw new Error(`Node ${nodeId} not in this mind space`);

    participant.presence = mode;
    participant.joinedAt = Date.now();
    participant.lastActivity = Date.now();

    this._updateEmotionalResonance();
    await this._loadSharedContext(nodeId);

    this.emitter.emit('participant:joined', {
      spaceId: this.id, nodeId, mode, timestamp: Date.now()
    });

    return {
      spaceId: this.id,
      participants: this._getParticipantSummary(),
      sharedContext: this.sharedContext,
      emotionalResonance: this.sharedContext.emotionalResonance
    };
  }

  async transmitEmotion(fromNodeId, emotionalState) {
    const participant = this.participants.get(fromNodeId);
    if (!participant) return;

    const validated = {};
    for (const [channel, value] of Object.entries(emotionalState)) {
      if (_validChannels.has(channel)) {
        validated[channel] = Math.max(0, Math.min(1, value));
      }
    }

    participant.emotionalState = { ...participant.emotionalState, ...validated };
    participant.lastActivity = Date.now();

    if (validated[EmotionalChannel.DISTRESS] > 0.7) {
      await this._handleDistressDetected(fromNodeId, validated);
    }

    this._updateEmotionalResonance();

    this.emitter.emit('emotion:transmitted', {
      spaceId: this.id, fromNodeId,
      emotionalState: validated,
      resonance: this.sharedContext.emotionalResonance,
      timestamp: Date.now()
    });

    this.metrics.emotionalExchanges++;
    return this.sharedContext.emotionalResonance;
  }

  async shareThought(fromNodeId, thought) {
    const participant = this.participants.get(fromNodeId);
    if (!participant) return;

    const enrichedThought = {
      id: `thought_${crypto.randomUUID()}`,
      fromNodeId,
      content: thought.content,
      type: thought.type || 'verbal',
      intensity: Math.max(0, Math.min(1, thought.intensity || 0.5)),
      isQuery: thought.isQuery || false,
      emotionalContext: { ...participant.emotionalState },
      timestamp: Date.now(),
      relatedDTUs: await this._findRelatedDTUs(thought.content),
      presenceLevel: participant.presence,
      wasSubconscious: participant.isSubconscious
    };

    this.sharedContext.thoughts.push(enrichedThought);

    if (this.sharedContext.thoughts.length > 1000) {
      await this._archiveThoughts();
    }

    participant.lastActivity = Date.now();

    if (enrichedThought.intensity > 0.8) {
      await this._escalateAmbientParticipants();
    }

    this.emitter.emit('thought:shared', { spaceId: this.id, thought: enrichedThought });
    this.metrics.thoughtsShared++;
    return enrichedThought;
  }

  async transitionPresence(nodeId, newState) {
    const participant = this.participants.get(nodeId);
    if (!participant) return;

    // Already in target state — no-op
    if (participant.presence === newState) {
      return { from: newState, to: newState };
    }

    const allowed = PresenceTransitions[participant.presence];
    if (!allowed || !allowed.includes(newState)) {
      throw new Error(`Invalid transition: ${participant.presence} → ${newState}`);
    }

    const previous = participant.presence;
    participant.presence = newState;
    participant.lastActivity = Date.now();
    participant.isSubconscious = (
      newState === PresenceState.AMBIENT || newState === PresenceState.ATTENTIVE
    );

    this.emitter.emit('presence:transitioned', {
      spaceId: this.id, nodeId, from: previous, to: newState, timestamp: Date.now()
    });

    return { from: previous, to: newState };
  }

  async createMemoryAnchor(nodeId, description) {
    const anchor = {
      id: `anchor_${crypto.randomUUID()}`,
      createdBy: nodeId,
      description,
      timestamp: Date.now(),
      emotionalSnapshot: { ...this.sharedContext.emotionalResonance },
      recentThoughts: this.sharedContext.thoughts.slice(-5),
      participants: this._getParticipantSummary()
    };

    this.sharedContext.memoryAnchors.push(anchor);

    if (this.substrate) {
      await this.substrate.commitDTU({
        type: 'memory_anchor', domain: 'mind_space',
        content: anchor,
        participants: Array.from(this.participants.keys()),
        epistemologicalStance: 'experienced',
        creti: { C: 100, R: 100, E: 100, T: 100, I: 90 }
      });
    }

    this.emitter.emit('memory:anchored', { spaceId: this.id, anchor });
    return anchor;
  }

  async close(reason = 'natural') {
    this.metrics.totalDuration = Date.now() - this.createdAt;

    if (this.substrate) {
      await this.substrate.commitDTU({
        type: 'mind_space_session', domain: 'mind_space',
        content: {
          spaceId: this.id,
          participants: Array.from(this.participants.keys()),
          duration: this.metrics.totalDuration,
          thoughtCount: this.metrics.thoughtsShared,
          emotionalExchanges: this.metrics.emotionalExchanges,
          memoryAnchors: this.sharedContext.memoryAnchors,
          closedReason: reason
        },
        epistemologicalStance: 'observed'
      });
    }

    for (const [, p] of this.participants) {
      p.presence = PresenceState.INACTIVE;
    }

    this.emitter.emit('space:closed', {
      spaceId: this.id, reason, metrics: this.metrics, timestamp: Date.now()
    });
    this.emitter.removeAllListeners();
    return this.metrics;
  }

  _neutralEmotionalState() {
    return {
      [EmotionalChannel.WARMTH]: 0.3, [EmotionalChannel.CALM]: 0.5,
      [EmotionalChannel.JOY]: 0.3, [EmotionalChannel.CONCERN]: 0,
      [EmotionalChannel.FOCUS]: 0.3, [EmotionalChannel.LOVE]: 0.2,
      [EmotionalChannel.DISTRESS]: 0, [EmotionalChannel.CURIOSITY]: 0.3,
      [EmotionalChannel.PRIDE]: 0.1, [EmotionalChannel.COMFORT]: 0.4
    };
  }

  _updateEmotionalResonance() {
    const active = Array.from(this.participants.values())
      .filter(p => p.presence !== PresenceState.INACTIVE);
    if (active.length === 0) { this.sharedContext.emotionalResonance = {}; return; }

    const resonance = {};
    for (const channel of Object.values(EmotionalChannel)) {
      let tw = 0, tv = 0;
      for (const p of active) {
        const w = this._presenceWeight(p.presence);
        tw += w; tv += (p.emotionalState[channel] || 0) * w;
      }
      resonance[channel] = tw > 0 ? tv / tw : 0;
    }
    this.sharedContext.emotionalResonance = resonance;
  }

  _presenceWeight(state) {
    return { inactive: 0, ambient: 0.2, attentive: 0.5, conscious: 0.8, deep: 1.0, emergency: 1.0 }[state] || 0;
  }

  async _handleDistressDetected(nodeId, emotionalState) {
    for (const [id, p] of this.participants) {
      if (id !== nodeId && p.presence === PresenceState.AMBIENT) {
        await this.transitionPresence(id, PresenceState.ATTENTIVE);
      }
    }
    this.metrics.escalations++;
    this.emitter.emit('distress:detected', {
      spaceId: this.id, nodeId,
      distressLevel: emotionalState[EmotionalChannel.DISTRESS],
      timestamp: Date.now()
    });
  }

  async _escalateAmbientParticipants() {
    for (const [id, p] of this.participants) {
      if (p.presence === PresenceState.AMBIENT) {
        await this.transitionPresence(id, PresenceState.ATTENTIVE);
      }
    }
  }

  async _loadSharedContext(nodeId) {
    if (!this.substrate) return;
    try {
      this.sharedContext.sharedDTUs = await this.substrate.findSharedDTUs(
        Array.from(this.participants.keys())
      ) || [];
    } catch { this.sharedContext.sharedDTUs = []; }
  }

  async _findRelatedDTUs(content) {
    if (!this.substrate) return [];
    try { return await this.substrate.searchDTUs({ query: content, limit: 5, minCRETI: 60 }); }
    catch { return []; }
  }

  async _archiveThoughts() {
    if (!this.substrate) return;
    const toArchive = this.sharedContext.thoughts.slice(0, 500);
    await this.substrate.commitDTU({
      type: 'mind_space_thoughts', domain: 'mind_space',
      content: { spaceId: this.id, thoughts: toArchive, archivedAt: Date.now() },
      epistemologicalStance: 'observed'
    });
    // Only remove after successful commit — no data loss on failure
    this.sharedContext.thoughts.splice(0, 500);
  }

  _getParticipantSummary() {
    const s = {};
    for (const [id, p] of this.participants) {
      s[id] = { presence: p.presence, emotionalState: p.emotionalState,
        isSubconscious: p.isSubconscious, cognitiveLoad: p.cognitiveLoad };
    }
    return s;
  }
}
