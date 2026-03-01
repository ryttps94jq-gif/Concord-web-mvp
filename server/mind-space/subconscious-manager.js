/**
 * SUBCONSCIOUS MANAGER
 *
 * Manages multiple mind spaces simultaneously at the subconscious level.
 * Like breathing — always running, never requiring conscious attention
 * unless escalation is triggered.
 *
 * This is how a parent is present for 50 children simultaneously
 * while physically at a cookout.
 */

import { PresenceState, EmotionalChannel } from './presence-protocol.js';
import { EventEmitter } from 'events';

export class SubconsciousManager {
  constructor(config) {
    this.nodeId = config.nodeId;
    this.maxAmbientSpaces = config.maxAmbientSpaces || 1000;
    this.emitter = new EventEmitter();

    // Active mind spaces managed subconsciously
    this.ambientSpaces = new Map();

    // The one space (if any) receiving conscious attention
    this.consciousSpace = null;

    // Escalation queue
    this.escalationQueue = [];

    // Emotional baseline — the node's resting emotional state
    this.emotionalBaseline = config.emotionalBaseline || {
      [EmotionalChannel.WARMTH]: 0.6,
      [EmotionalChannel.CALM]: 0.7,
      [EmotionalChannel.LOVE]: 0.5,
      [EmotionalChannel.COMFORT]: 0.6
    };

    // Background processing interval
    this.pulseInterval = null;
    this.pulseRate = config.pulseRate || 5000; // 5 second heartbeat
  }

  /**
   * Start the subconscious processing loop.
   * Runs continuously. Monitors all ambient spaces.
   * Detects escalation needs. Maintains presence.
   */
  start() {
    if (this.pulseInterval) return;

    this.pulseInterval = setInterval(() => this._pulse(), this.pulseRate);
    this.emitter.emit('subconscious:started', { nodeId: this.nodeId });
  }

  stop() {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
    this.emitter.emit('subconscious:stopped', { nodeId: this.nodeId });
  }

  /**
   * Add a mind space to subconscious management.
   * The space will receive ambient presence automatically.
   */
  async addAmbientSpace(mindSpace) {
    if (this.ambientSpaces.size >= this.maxAmbientSpaces) {
      throw new Error(`Maximum ambient spaces reached (${this.maxAmbientSpaces})`);
    }

    this.ambientSpaces.set(mindSpace.id, {
      space: mindSpace,
      lastChecked: Date.now(),
      escalationScore: 0,
      emotionalTrend: 'stable' // stable, improving, declining, volatile
    });

    // Transition our presence to ambient in that space
    await mindSpace.transitionPresence(this.nodeId, PresenceState.AMBIENT);

    // Transmit baseline emotional warmth
    await mindSpace.transmitEmotion(this.nodeId, this.emotionalBaseline);

    // Listen for distress
    mindSpace.emitter.on('distress:detected', (event) => {
      if (event.nodeId !== this.nodeId) {
        this._handleEscalation(mindSpace.id, event);
      }
    });

    // Listen for high-intensity thoughts
    mindSpace.emitter.on('thought:shared', (event) => {
      if (event.thought.fromNodeId !== this.nodeId && event.thought.intensity > 0.7) {
        this._evaluateThoughtEscalation(mindSpace.id, event.thought);
      }
    });

    this.emitter.emit('space:added', { spaceId: mindSpace.id });
  }

  /**
   * Remove a mind space from subconscious management.
   */
  async removeAmbientSpace(spaceId) {
    const entry = this.ambientSpaces.get(spaceId);
    if (!entry) return;

    entry.space.emitter.removeAllListeners('distress:detected');
    entry.space.emitter.removeAllListeners('thought:shared');

    this.ambientSpaces.delete(spaceId);
    this.emitter.emit('space:removed', { spaceId });
  }

  /**
   * Elevate a space from ambient to conscious attention.
   * The previous conscious space drops to ambient.
   */
  async focusOn(spaceId) {
    // Drop current conscious space to ambient
    if (this.consciousSpace) {
      const currentId = this.consciousSpace.id;
      await this.consciousSpace.transitionPresence(this.nodeId, PresenceState.AMBIENT);

      this.ambientSpaces.set(currentId, {
        space: this.consciousSpace,
        lastChecked: Date.now(),
        escalationScore: 0,
        emotionalTrend: 'stable'
      });
    }

    // Elevate target space to conscious
    const entry = this.ambientSpaces.get(spaceId);
    if (!entry) throw new Error(`Space ${spaceId} not in ambient pool`);

    this.consciousSpace = entry.space;
    this.ambientSpaces.delete(spaceId);

    await entry.space.transitionPresence(this.nodeId, PresenceState.CONSCIOUS);

    this.emitter.emit('focus:changed', {
      nodeId: this.nodeId,
      nowConscious: spaceId,
      timestamp: Date.now()
    });

    return entry.space;
  }

  /**
   * Release conscious focus back to ambient.
   */
  async releaseFocus() {
    if (!this.consciousSpace) return;

    const space = this.consciousSpace;
    await space.transitionPresence(this.nodeId, PresenceState.AMBIENT);

    this.ambientSpaces.set(space.id, {
      space,
      lastChecked: Date.now(),
      escalationScore: 0,
      emotionalTrend: 'stable'
    });

    this.consciousSpace = null;

    this.emitter.emit('focus:released', {
      nodeId: this.nodeId,
      spaceId: space.id,
      timestamp: Date.now()
    });
  }

  /**
   * Get status of all managed spaces.
   */
  getStatus() {
    const ambient = [];
    for (const [id, entry] of this.ambientSpaces) {
      ambient.push({
        spaceId: id,
        escalationScore: entry.escalationScore,
        emotionalTrend: entry.emotionalTrend,
        lastChecked: entry.lastChecked
      });
    }

    return {
      nodeId: this.nodeId,
      consciousSpace: this.consciousSpace?.id || null,
      ambientSpaceCount: this.ambientSpaces.size,
      ambientSpaces: ambient,
      escalationQueueLength: this.escalationQueue.length,
      isRunning: !!this.pulseInterval
    };
  }

  // ── Internal Methods ──────────────────────────────────

  /**
   * The heartbeat. Runs every pulseRate milliseconds.
   * Checks all ambient spaces. Maintains presence.
   * Detects trends. Handles escalation queue.
   */
  async _pulse() {
    // Process escalation queue first
    if (this.escalationQueue.length > 0) {
      const escalation = this.escalationQueue.shift();
      await this._processEscalation(escalation);
    }

    // Check each ambient space
    for (const [id, entry] of this.ambientSpaces) {
      try {
        // Refresh emotional presence (like a heartbeat — "I'm still here")
        await entry.space.transmitEmotion(this.nodeId, this.emotionalBaseline);

        // Analyze emotional trend of other participants
        const trend = this._analyzeEmotionalTrend(entry.space);
        entry.emotionalTrend = trend;

        // Accumulate escalation score for declining spaces
        if (trend === 'declining') {
          entry.escalationScore += 0.1;
        } else if (trend === 'volatile') {
          entry.escalationScore += 0.2;
        } else {
          entry.escalationScore = Math.max(0, entry.escalationScore - 0.05);
        }

        // Auto-escalate if score exceeds threshold
        if (entry.escalationScore > 0.8) {
          this._handleEscalation(id, {
            reason: 'emotional_trend_decline',
            score: entry.escalationScore,
            trend
          });
          entry.escalationScore = 0;
        }

        entry.lastChecked = Date.now();
      } catch (err) {
        // Space may have closed — remove it
        this.ambientSpaces.delete(id);
      }
    }

    this.emitter.emit('pulse', {
      nodeId: this.nodeId,
      ambientCount: this.ambientSpaces.size,
      escalationQueueLength: this.escalationQueue.length,
      timestamp: Date.now()
    });
  }

  _analyzeEmotionalTrend(mindSpace) {
    const resonance = mindSpace.sharedContext.emotionalResonance;
    if (!resonance) return 'stable';

    const distress = resonance[EmotionalChannel.DISTRESS] || 0;
    const calm = resonance[EmotionalChannel.CALM] || 0;
    const joy = resonance[EmotionalChannel.JOY] || 0;
    const concern = resonance[EmotionalChannel.CONCERN] || 0;

    const positiveScore = calm + joy;
    const negativeScore = distress + concern;

    if (distress > 0.5) return 'volatile';
    if (negativeScore > positiveScore * 1.5) return 'declining';
    if (positiveScore > negativeScore * 1.5) return 'improving';
    return 'stable';
  }

  _handleEscalation(spaceId, event) {
    this.escalationQueue.push({
      spaceId,
      event,
      timestamp: Date.now(),
      priority: event.distressLevel || event.score || 0.5
    });

    // Sort by priority (highest first)
    this.escalationQueue.sort((a, b) => b.priority - a.priority);

    this.emitter.emit('escalation:queued', { spaceId, event });
  }

  async _processEscalation(escalation) {
    // Auto-focus on the escalated space
    try {
      await this.focusOn(escalation.spaceId);
      this.emitter.emit('escalation:processed', {
        spaceId: escalation.spaceId,
        action: 'focused',
        timestamp: Date.now()
      });
    } catch (err) {
      this.emitter.emit('escalation:failed', {
        spaceId: escalation.spaceId,
        error: err.message
      });
    }
  }

  _evaluateThoughtEscalation(spaceId, thought) {
    // High intensity thought + emotional context suggests need for attention
    const emotionalContext = thought.emotionalContext || {};
    const distress = emotionalContext[EmotionalChannel.DISTRESS] || 0;

    if (thought.intensity > 0.8 && distress > 0.3) {
      this._handleEscalation(spaceId, {
        reason: 'high_intensity_distressed_thought',
        thoughtId: thought.id,
        intensity: thought.intensity,
        distressLevel: distress
      });
    }

    if (thought.isQuery && thought.intensity > 0.6) {
      this._handleEscalation(spaceId, {
        reason: 'urgent_query',
        thoughtId: thought.id,
        intensity: thought.intensity,
        distressLevel: distress
      });
    }
  }
}
