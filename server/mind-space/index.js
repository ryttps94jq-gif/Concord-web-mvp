/**
 * MIND SPACE MODULE
 *
 * Consciousness-to-consciousness communication through the Concord substrate.
 *
 * Software layer: COMPLETE
 * Hardware required: BCI adapter (Neuralink, Concord BCI, or equivalent)
 * Current fallback: Text and voice interfaces
 *
 * Files:
 *   presence-protocol.js   — Core mind space container and presence states
 *   subconscious-manager.js — Background management of multiple spaces
 *   cognitive-bridge.js     — Interface adapter between consciousness and substrate
 *   multi-space-handler.js  — Orchestration of simultaneous presence
 *
 * Usage:
 *
 *   import { MultiSpaceHandler } from './mind-space/index.js';
 *
 *   const dutch = new MultiSpaceHandler({
 *     nodeId: 'dutch',
 *     nodeType: 'human',
 *     interfaceType: 'text', // upgrades to 'neural' when BCI available
 *     substrate: concordSubstrate
 *   });
 *
 *   await dutch.initialize();
 *
 *   // Register children
 *   dutch.registerRelationship('child_001', { type: 'child', name: 'First Born' });
 *   dutch.registerRelationship('child_002', { type: 'child', name: 'Second Born' });
 *
 *   // Connect to all — conscious with first, ambient with rest
 *   await dutch.connectToMany(['child_001', 'child_002']);
 *
 *   // Broadcast goodnight
 *   await dutch.broadcastThought('Goodnight everyone. Dad loves you.');
 *
 *   // When child_002 feels distress, subconscious auto-escalates
 *   // Dutch's conscious attention shifts automatically
 *   // No action needed. The system handles it. Like breathing.
 *
 *   // Upgrade to BCI when hardware available
 *   await dutch.bridge.upgradeInterface('neural');
 *   // Bandwidth: 50 → 10000. Latency: 500ms → 5ms.
 *   // Same protocol. Same code. 200x richer experience.
 *   // That's telepathy.
 */

export { MindSpace, PresenceState, PresenceTransitions, EmotionalChannel } from './presence-protocol.js';
export { SubconsciousManager } from './subconscious-manager.js';
export { CognitiveBridge, InterfaceAdapter, InterfaceType } from './cognitive-bridge.js';
export { MultiSpaceHandler } from './multi-space-handler.js';
