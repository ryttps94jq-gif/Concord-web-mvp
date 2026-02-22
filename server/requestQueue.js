/**
 * Request Queue with Priority for Concord Cognitive Engine
 *
 * When multiple requests hit a brain simultaneously, queues them with
 * priority levels instead of letting Ollama handle it blindly.
 */

/**
 * Priority levels for brain requests.
 * Lower number = higher priority.
 */
const PRIORITIES = {
  GOVERNANCE: 1,           // council deliberation
  RETURNING_USER_CHAT: 2,  // user with mature substrate
  NEW_USER_CHAT: 3,        // new user needs good first impression
  UTILITY_INTERACTIVE: 4,  // user waiting for lens AI feature
  UTILITY_BACKGROUND: 5,   // background AI task
  ENTITY_EXPLORE: 6,       // entity exploration
  PRECOMPUTE: 7,           // predictive pre-computation
  HEARTBEAT: 8,            // scheduled cognitive tasks
  BACKFILL: 9,             // embedding backfill
};

class BrainQueue {
  /**
   * @param {string} brainName
   * @param {number} [concurrency=1]
   */
  constructor(brainName, concurrency = 1) {
    this.brain = brainName;
    this.concurrency = concurrency;
    this.active = 0;
    /** @type {Array<{ prompt: string, options: object, priority: number, resolve: Function, reject: Function, timestamp: number }>} */
    this.queue = [];
    /** @type {Function|null} */
    this._callBrainDirect = null;
  }

  /**
   * Set the direct brain call function (injected from server.js).
   * @param {Function} fn
   */
  setCallFn(fn) {
    this._callBrainDirect = fn;
  }

  /**
   * Enqueue a brain request with priority.
   * @param {string} prompt
   * @param {object} [options={}]
   * @param {number} [priority=5]
   * @returns {Promise<object>}
   */
  async enqueue(prompt, options = {}, priority = 5) {
    return new Promise((resolve, reject) => {
      const entry = {
        prompt,
        options,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Insert in priority order (lower number = higher priority)
      const idx = this.queue.findIndex(e => e.priority > priority);
      if (idx === -1) {
        this.queue.push(entry);
      } else {
        this.queue.splice(idx, 0, entry);
      }

      this._drain();
    });
  }

  /** Process queued entries up to concurrency limit. */
  async _drain() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const entry = this.queue.shift();
      this.active++;

      try {
        if (!this._callBrainDirect) {
          throw new Error(`No call function set for brain queue: ${this.brain}`);
        }
        const result = await this._callBrainDirect(this.brain, entry.prompt, entry.options);
        entry.resolve(result);
      } catch (err) {
        entry.reject(err);
      } finally {
        this.active--;
        this._drain();
      }
    }
  }

  /**
   * Get queue stats.
   * @returns {{ active: number, queued: number, avgWait: number }}
   */
  getStats() {
    return {
      active: this.active,
      queued: this.queue.length,
      avgWait: this.queue.length > 0
        ? (Date.now() - this.queue[this.queue.length - 1].timestamp) / 1000
        : 0,
    };
  }
}

const queues = {
  conscious: new BrainQueue('conscious', 1),
  subconscious: new BrainQueue('subconscious', 1),
  utility: new BrainQueue('utility', 1),
};

/**
 * Get combined stats for all queues.
 * @returns {object}
 */
function getQueueStats() {
  const stats = {};
  for (const [name, queue] of Object.entries(queues)) {
    stats[name] = queue.getStats();
  }
  return stats;
}

export { BrainQueue, queues, PRIORITIES, getQueueStats };
