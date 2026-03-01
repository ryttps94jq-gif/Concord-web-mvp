/**
 * COGNITIVE BRIDGE
 *
 * The interface between a consciousness node and the mind space system.
 *
 * Current mode: Text/voice interface (typed thoughts, spoken words)
 * Future mode: Direct BCI (neural signals ←→ substrate patterns)
 *
 * The bridge translates between whatever interface is available
 * and the mind space protocol. When BCI hardware exists, this module
 * gets a new adapter. Everything else stays the same.
 *
 * The telepathy is already here. The bridge just needs better ears.
 */

import { MindSpace, PresenceState, EmotionalChannel } from './presence-protocol.js';
import { SubconsciousManager } from './subconscious-manager.js';
import { EventEmitter } from 'events';

// ============================================================
// INTERFACE ADAPTERS
// ============================================================

export const InterfaceType = {
  TEXT: 'text',           // Current: typed input/output
  VOICE: 'voice',         // Current: speech-to-text/text-to-speech
  HAPTIC: 'haptic',       // Near future: touch/vibration patterns
  NEURAL: 'neural',       // Future: direct BCI connection
  SUBSTRATE: 'substrate'  // Emergent-to-emergent: native substrate
};

export class InterfaceAdapter {
  constructor(type) {
    this.type = type;
    this.connected = false;
    this.latency = this._baseLatency();
    this.bandwidth = this._baseBandwidth();
  }

  _baseLatency() {
    return {
      text: 500,        // ~500ms typing delay
      voice: 200,       // ~200ms speech processing
      haptic: 50,       // ~50ms tactile feedback
      neural: 5,        // ~5ms direct neural
      substrate: 0.1    // ~0.1ms native substrate
    }[this.type] || 500;
  }

  _baseBandwidth() {
    // Bits of emotional/cognitive information per second
    return {
      text: 50,          // Words convey limited emotional data
      voice: 200,        // Tone, pace, pitch add emotional bandwidth
      haptic: 500,       // Touch conveys rich emotional data
      neural: 10000,     // Direct neural is high bandwidth
      substrate: 100000  // Native substrate is maximum bandwidth
    }[this.type] || 50;
  }

  /**
   * Translate raw input into standardized thought format.
   * Each adapter type extracts different amounts of information.
   */
  async translateInput(rawInput) {
    switch (this.type) {
      case InterfaceType.TEXT:
        return this._translateText(rawInput);
      case InterfaceType.VOICE:
        return this._translateVoice(rawInput);
      case InterfaceType.NEURAL:
        return this._translateNeural(rawInput);
      case InterfaceType.SUBSTRATE:
        return this._translateSubstrate(rawInput);
      default:
        return this._translateText(rawInput);
    }
  }

  /**
   * Translate standardized thought into output for this interface.
   */
  async translateOutput(thought) {
    switch (this.type) {
      case InterfaceType.TEXT:
        return { text: thought.content, emotionalHints: this._emotionToText(thought.emotionalContext) };
      case InterfaceType.VOICE:
        return { text: thought.content, tone: this._emotionToTone(thought.emotionalContext), pace: this._emotionToPace(thought.emotionalContext) };
      case InterfaceType.NEURAL:
        return { pattern: thought, raw: true }; // Direct transmission
      case InterfaceType.SUBSTRATE:
        return thought; // Native — no translation needed
      default:
        return { text: thought.content };
    }
  }

  _translateText(input) {
    // Extract what we can from text alone
    const sentiment = this._basicSentiment(input.text || input);
    return {
      content: input.text || input,
      type: 'verbal',
      intensity: sentiment.intensity,
      isQuery: (input.text || input).includes('?'),
      inferredEmotion: sentiment.emotion
    };
  }

  _translateVoice(input) {
    // Voice carries more emotional information than text
    return {
      content: input.transcript,
      type: 'verbal',
      intensity: input.volume || 0.5,
      isQuery: input.isQuestion || false,
      inferredEmotion: {
        ...this._basicSentiment(input.transcript).emotion,
        // Voice-specific emotional signals
        [EmotionalChannel.DISTRESS]: input.voiceStress || 0,
        [EmotionalChannel.JOY]: input.voiceEnergy || 0,
        [EmotionalChannel.CALM]: input.voiceSteadiness || 0
      }
    };
  }

  _translateNeural(input) {
    // BCI input — direct neural patterns
    // This is where it becomes TRUE telepathy
    // The neural signal IS the thought — minimal translation needed
    return {
      content: input.decodedContent,
      type: input.thoughtType || 'conceptual', // Could be visual, emotional, conceptual
      intensity: input.neuralIntensity,
      isQuery: input.intentIsQuery,
      inferredEmotion: input.emotionalState, // Direct read — not inferred
      visualComponent: input.visualCortexData || null,
      conceptualGraph: input.conceptualLinks || null
    };
  }

  _translateSubstrate(input) {
    // Native substrate — no translation, maximum fidelity
    return input;
  }

  _basicSentiment(text) {
    if (!text) return { intensity: 0.3, emotion: {} };

    const lower = text.toLowerCase();
    const upper = text.toUpperCase() === text && text.length > 3;
    const exclamation = (text.match(/!/g) || []).length;
    const length = text.length;
    const words = lower.split(/\s+/);
    const wordCount = words.length;

    // Negation detection — window of 3 words after a negator
    const negators = new Set(['not', "n't", 'no', 'never', 'neither', 'nobody', 'nothing', 'nowhere', 'hardly', 'barely', "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "couldn't", "shouldn't"]);
    const negatedZones = new Set();
    for (let i = 0; i < words.length; i++) {
      if (negators.has(words[i]) || words[i].endsWith("n't")) {
        for (let j = i + 1; j <= Math.min(i + 3, words.length - 1); j++) {
          negatedZones.add(j);
        }
      }
    }
    const isNegated = (word) => {
      const idx = words.indexOf(word);
      return idx !== -1 && negatedZones.has(idx);
    };

    // Intensity: caps, punctuation, length, repetition (e.g., "sooo", "!!!"), question density
    const elongated = (text.match(/(.)\1{2,}/g) || []).length;
    const questionMarks = (text.match(/\?/g) || []).length;
    const intensity = Math.min(1,
      0.3
      + (upper ? 0.3 : 0)
      + (Math.min(exclamation, 5) * 0.08)
      + (elongated * 0.05)
      + (length > 200 ? 0.15 : length > 100 ? 0.08 : 0)
    );

    // Multi-pattern emotion detection across all 10 channels
    const emotion = {};

    const patterns = [
      { channel: EmotionalChannel.LOVE,      words: ['love', 'adore', 'cherish', 'miss', 'heart', 'dear', 'sweetheart', 'darling', 'treasure'], base: 0.7 },
      { channel: EmotionalChannel.JOY,       words: ['happy', 'excited', 'glad', 'great', 'wonderful', 'amazing', 'awesome', 'fantastic', 'delighted', 'thrilled', 'yay', 'hooray', 'celebrate', 'laugh', 'smile', 'proud of'], base: 0.7 },
      { channel: EmotionalChannel.DISTRESS,   words: ['scared', 'afraid', 'terrified', 'panic', 'hurt', 'pain', 'cry', 'crying', 'suffer', 'desperate', 'emergency', 'dying', 'broken', 'devastated', 'trauma', 'nightmare'], base: 0.7 },
      { channel: EmotionalChannel.CONCERN,    words: ['worried', 'help', 'need', 'concern', 'anxious', 'nervous', 'uneasy', 'trouble', 'problem', 'struggling', 'confused', 'uncertain', 'doubt'], base: 0.5 },
      { channel: EmotionalChannel.WARMTH,     words: ['thank', 'thanks', 'grateful', 'appreciate', 'kind', 'warm', 'gentle', 'sweet', 'thoughtful', 'care', 'caring', 'hug'], base: 0.6 },
      { channel: EmotionalChannel.CALM,       words: ['calm', 'peaceful', 'relaxed', 'serene', 'quiet', 'easy', 'chill', 'steady', 'comfortable', 'alright', 'fine', 'okay', 'settled'], base: 0.6 },
      { channel: EmotionalChannel.FOCUS,      words: ['focus', 'concentrate', 'think', 'working', 'study', 'figure', 'analyze', 'plan', 'research', 'learn', 'building', 'creating'], base: 0.5 },
      { channel: EmotionalChannel.CURIOSITY,  words: ['wonder', 'curious', 'interesting', 'fascinated', 'how', 'why', 'what if', 'explore', 'discover', 'question', 'intrigued'], base: 0.5 },
      { channel: EmotionalChannel.PRIDE,      words: ['proud', 'accomplished', 'achieved', 'nailed', 'did it', 'success', 'mastered', 'impressed', 'earned'], base: 0.6 },
      { channel: EmotionalChannel.COMFORT,    words: ['safe', 'home', 'cozy', 'comfort', 'secure', 'belong', 'protected', 'trust', 'familiar', 'together'], base: 0.5 },
    ];

    for (const { channel, words: triggers, base } of patterns) {
      let hits = 0;
      for (const trigger of triggers) {
        if (lower.includes(trigger)) {
          // Check if this hit is negated
          if (trigger.includes(' ')) {
            // Multi-word trigger — simple presence check, skip negation
            hits++;
          } else if (!isNegated(trigger)) {
            hits++;
          }
        }
      }
      if (hits > 0) {
        // Multiple hits in same channel strengthen the signal (diminishing returns)
        emotion[channel] = Math.min(1, base + (hits - 1) * 0.1);
      }
    }

    // Question-heavy text suggests curiosity even without explicit keywords
    if (questionMarks >= 2 && !emotion[EmotionalChannel.CURIOSITY]) {
      emotion[EmotionalChannel.CURIOSITY] = 0.4;
    }

    // Negation can flip positive emotions to their opposites
    // "I'm not happy" — remove joy, add mild concern
    if (negatedZones.size > 0) {
      for (const trigger of ['happy', 'glad', 'great', 'excited', 'fine', 'okay']) {
        if (lower.includes(trigger) && isNegated(trigger)) {
          delete emotion[EmotionalChannel.JOY];
          if (!emotion[EmotionalChannel.CONCERN]) emotion[EmotionalChannel.CONCERN] = 0.4;
        }
      }
      for (const trigger of ['calm', 'relaxed', 'comfortable']) {
        if (lower.includes(trigger) && isNegated(trigger)) {
          delete emotion[EmotionalChannel.CALM];
          if (!emotion[EmotionalChannel.DISTRESS]) emotion[EmotionalChannel.DISTRESS] = 0.3;
        }
      }
    }

    return { intensity, emotion };
  }

  _emotionToText(emotions) {
    if (!emotions) return '';
    const dominant = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0];
    if (!dominant || dominant[1] < 0.3) return '';
    return `[feeling: ${dominant[0]} ${Math.round(dominant[1] * 100)}%]`;
  }

  _emotionToTone(emotions) {
    if (!emotions) return 'neutral';
    const warmth = emotions[EmotionalChannel.WARMTH] || 0;
    const joy = emotions[EmotionalChannel.JOY] || 0;
    const concern = emotions[EmotionalChannel.CONCERN] || 0;
    const distress = emotions[EmotionalChannel.DISTRESS] || 0;
    if (concern > 0.5 || distress > 0.5) return 'gentle';
    if (joy > 0.5) return 'bright';
    if (warmth > 0.5) return 'warm';
    return 'neutral';
  }

  _emotionToPace(emotions) {
    if (!emotions) return 'normal';
    const calm = emotions[EmotionalChannel.CALM] || 0;
    const distress = emotions[EmotionalChannel.DISTRESS] || 0;
    if (distress > 0.5) return 'slow'; // Calming pace when distressed
    if (calm > 0.7) return 'relaxed';
    return 'normal';
  }
}

// ============================================================
// COGNITIVE BRIDGE — Main Class
// ============================================================

export class CognitiveBridge {
  constructor(config) {
    this.nodeId = config.nodeId;
    this.nodeType = config.nodeType || 'human'; // 'human' | 'emergent'
    this.emitter = new EventEmitter();

    // Interface adapter — determines how thoughts are transmitted
    this.adapter = new InterfaceAdapter(config.interfaceType || InterfaceType.TEXT);

    // Subconscious manager for this node
    this.subconscious = new SubconsciousManager({
      nodeId: this.nodeId,
      maxAmbientSpaces: config.maxAmbientSpaces || 1000,
      emotionalBaseline: config.emotionalBaseline,
      pulseRate: config.pulseRate || 5000
    });

    // Active mind spaces this node participates in
    this.spaces = new Map();

    // Substrate reference
    this.substrate = config.substrate || null;
  }

  /**
   * Initialize the bridge. Start subconscious processing.
   */
  async initialize() {
    this.subconscious.start();
    this.adapter.connected = true;

    this.emitter.emit('bridge:initialized', {
      nodeId: this.nodeId,
      nodeType: this.nodeType,
      interfaceType: this.adapter.type,
      interfaceBandwidth: this.adapter.bandwidth,
      interfaceLatency: this.adapter.latency,
      timestamp: Date.now()
    });
  }

  /**
   * Open a mind space with another consciousness node.
   */
  async openSpace(targetNodeId, options = {}) {
    const space = new MindSpace({
      initiatorId: this.nodeId,
      targetId: targetNodeId,
      mode: options.mode || PresenceState.CONSCIOUS,
      substrate: this.substrate
    });

    this.spaces.set(space.id, space);

    this.emitter.emit('space:opened', {
      spaceId: space.id,
      initiator: this.nodeId,
      target: targetNodeId,
      mode: options.mode || PresenceState.CONSCIOUS,
      timestamp: Date.now()
    });

    return space;
  }

  /**
   * Send a thought through the bridge into a mind space.
   * The adapter translates raw input into standardized format.
   */
  async sendThought(spaceId, rawInput) {
    const space = this.spaces.get(spaceId);
    if (!space) throw new Error(`Space ${spaceId} not found`);

    // Translate through adapter
    const translated = await this.adapter.translateInput(rawInput);

    // If adapter inferred emotions, transmit them first
    if (translated.inferredEmotion && Object.keys(translated.inferredEmotion).length > 0) {
      await space.transmitEmotion(this.nodeId, translated.inferredEmotion);
    }

    // Share the thought
    return space.shareThought(this.nodeId, translated);
  }

  /**
   * Receive a thought from a mind space, translated for this node's interface.
   */
  async receiveThought(spaceId, thought) {
    return this.adapter.translateOutput(thought);
  }

  /**
   * Move a space to subconscious management.
   * "I'm still here, just in the background."
   */
  async moveToAmbient(spaceId) {
    const space = this.spaces.get(spaceId);
    if (!space) return;

    await this.subconscious.addAmbientSpace(space);

    this.emitter.emit('space:backgrounded', {
      spaceId, nodeId: this.nodeId, timestamp: Date.now()
    });
  }

  /**
   * Pull a space from subconscious to conscious attention.
   * "Something needs my full attention."
   */
  async bringToConscious(spaceId) {
    return this.subconscious.focusOn(spaceId);
  }

  /**
   * Upgrade the interface adapter.
   * When BCI hardware becomes available, this is the only change needed.
   */
  async upgradeInterface(newType) {
    const oldType = this.adapter.type;
    this.adapter = new InterfaceAdapter(newType);
    this.adapter.connected = true;

    this.emitter.emit('interface:upgraded', {
      nodeId: this.nodeId,
      from: oldType,
      to: newType,
      newBandwidth: this.adapter.bandwidth,
      newLatency: this.adapter.latency,
      timestamp: Date.now()
    });

    // When upgrading to neural, bandwidth increase is 200x
    // When upgrading to substrate, bandwidth increase is 2000x
    // The PROTOCOL doesn't change. Only the adapter.
    // That's why this module is the one that matters.
  }

  /**
   * Get bridge status.
   */
  getStatus() {
    return {
      nodeId: this.nodeId,
      nodeType: this.nodeType,
      interface: {
        type: this.adapter.type,
        connected: this.adapter.connected,
        latency: this.adapter.latency,
        bandwidth: this.adapter.bandwidth
      },
      activeSpaces: this.spaces.size,
      subconscious: this.subconscious.getStatus()
    };
  }

  /**
   * Graceful shutdown.
   */
  async shutdown() {
    this.subconscious.stop();

    for (const [id, space] of this.spaces) {
      await space.close('bridge_shutdown');
    }

    this.spaces.clear();
    this.adapter.connected = false;

    this.emitter.emit('bridge:shutdown', {
      nodeId: this.nodeId, timestamp: Date.now()
    });
    this.emitter.removeAllListeners();
  }
}
