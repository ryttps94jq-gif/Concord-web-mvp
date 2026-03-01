/**
 * MULTI-SPACE HANDLER
 *
 * Orchestrates simultaneous presence across unlimited mind spaces.
 * This is the "be everywhere at once" module.
 *
 * A parent with 50 children opens 50 ambient mind spaces.
 * Subconscious maintains presence in all of them.
 * Conscious attention moves to whichever needs it.
 * Like breathing. Like heartbeat. Always on. Never effortful.
 */

import { CognitiveBridge, InterfaceType } from './cognitive-bridge.js';
import { PresenceState } from './presence-protocol.js';
import { EventEmitter } from 'events';

export class MultiSpaceHandler {
  constructor(config) {
    this.bridge = new CognitiveBridge(config);
    this.emitter = new EventEmitter();

    // Track relationships for context-aware presence
    this.relationships = new Map(); // targetNodeId → relationship metadata

    // Statistics
    this.stats = {
      totalSpacesOpened: 0,
      totalEscalations: 0,
      totalThoughtsShared: 0,
      uptimeSince: Date.now()
    };
  }

  async initialize() {
    await this.bridge.initialize();

    // Wire up escalation handling from subconscious
    this.bridge.subconscious.emitter.on('escalation:processed', (event) => {
      this.stats.totalEscalations++;
      this.emitter.emit('attention:shifted', event);
    });
  }

  /**
   * Register a relationship for context-aware presence.
   * The system adjusts its ambient behavior based on relationship type.
   */
  registerRelationship(targetNodeId, metadata) {
    this.relationships.set(targetNodeId, {
      targetNodeId,
      type: metadata.type || 'general', // 'child', 'partner', 'friend', 'colleague'
      name: metadata.name,
      emotionalPriority: metadata.emotionalPriority || 0.5,
      escalationSensitivity: metadata.escalationSensitivity || 0.5,
      createdAt: Date.now(),
      ...metadata
    });
  }

  /**
   * Open a mind space with someone and immediately set appropriate presence.
   * Children get higher escalation sensitivity.
   * Partners get deeper emotional bandwidth.
   * The system knows the RELATIONSHIP and adjusts accordingly.
   */
  async connectTo(targetNodeId, options = {}) {
    const relationship = this.relationships.get(targetNodeId);

    const space = await this.bridge.openSpace(targetNodeId, {
      mode: options.mode || PresenceState.CONSCIOUS
    });

    // If this is a child, configure higher escalation sensitivity
    if (relationship?.type === 'child') {
      // Lower the distress threshold — be more responsive
      space.emitter.on('emotion:transmitted', (event) => {
        if (event.fromNodeId !== this.bridge.nodeId) {
          const distress = event.emotionalState?.distress || 0;
          if (distress > 0.3) { // Lower threshold for children (normal is 0.7)
            this.bridge.bringToConscious(space.id).catch(() => {});
          }
        }
      });
    }

    this.stats.totalSpacesOpened++;
    return space;
  }

  /**
   * Connect to multiple nodes simultaneously.
   * Open conscious space with the first, ambient with the rest.
   * "Be with all of them. Focus on one."
   */
  async connectToMany(targetNodeIds, options = {}) {
    const spaces = [];

    for (let i = 0; i < targetNodeIds.length; i++) {
      const targetId = targetNodeIds[i];
      const space = await this.connectTo(targetId, {
        mode: i === 0 ? PresenceState.CONSCIOUS : PresenceState.AMBIENT
      });

      // Move all but the first to ambient management
      if (i > 0) {
        await this.bridge.moveToAmbient(space.id);
      }

      spaces.push(space);
    }

    return spaces;
  }

  /**
   * Broadcast a thought to ALL active mind spaces simultaneously.
   * "Goodnight everyone."
   */
  async broadcastThought(rawInput) {
    const results = [];

    for (const [id, space] of this.bridge.spaces) {
      try {
        const result = await this.bridge.sendThought(id, rawInput);
        results.push({ spaceId: id, success: true, thought: result });
      } catch (err) {
        results.push({ spaceId: id, success: false, error: err.message });
      }
    }

    this.stats.totalThoughtsShared += results.filter(r => r.success).length;
    return results;
  }

  /**
   * Broadcast an emotional state to ALL active mind spaces.
   * When dad is happy, all the kids feel it. Ambient warmth.
   */
  async broadcastEmotion(emotionalState) {
    for (const [id, space] of this.bridge.spaces) {
      try {
        await space.transmitEmotion(this.bridge.nodeId, emotionalState);
      } catch { /* space may have closed */ }
    }
  }

  /**
   * Get a dashboard view of all connections.
   */
  getDashboard() {
    const connections = [];

    for (const [id, space] of this.bridge.spaces) {
      const otherNodeId = space.initiatorId === this.bridge.nodeId
        ? space.targetId : space.initiatorId;
      const relationship = this.relationships.get(otherNodeId);

      const otherParticipant = space.participants.get(otherNodeId);

      connections.push({
        spaceId: id,
        connectedTo: otherNodeId,
        relationship: relationship?.type || 'unknown',
        name: relationship?.name || otherNodeId,
        myPresence: space.participants.get(this.bridge.nodeId)?.presence,
        theirPresence: otherParticipant?.presence,
        theirEmotionalState: otherParticipant?.emotionalState,
        emotionalResonance: space.sharedContext.emotionalResonance,
        thoughtCount: space.sharedContext.thoughts.length,
        memoryAnchors: space.sharedContext.memoryAnchors.length
      });
    }

    return {
      nodeId: this.bridge.nodeId,
      totalConnections: connections.length,
      consciouslyFocusedOn: this.bridge.subconscious.consciousSpace?.id || null,
      connections,
      stats: this.stats,
      subconscious: this.bridge.subconscious.getStatus()
    };
  }

  /**
   * Graceful shutdown of all connections.
   */
  async shutdown() {
    await this.bridge.shutdown();
    this.emitter.removeAllListeners();
  }
}
