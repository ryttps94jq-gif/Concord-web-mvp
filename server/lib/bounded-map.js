/**
 * Concord Cognitive Engine — BoundedMap
 *
 * A Map wrapper with a maximum size limit and LRU eviction.
 * Prevents unbounded memory growth from global stores.
 *
 * When the map exceeds maxSize, the oldest entries (by insertion order)
 * are evicted. Uses JavaScript Map's insertion-order guarantee.
 */

export class BoundedMap extends Map {
  /**
   * @param {number} maxSize - Maximum number of entries
   * @param {string} [name] - Name for logging eviction events
   */
  constructor(maxSize = 10000, name = "BoundedMap") {
    super();
    this._maxSize = maxSize;
    this._name = name;
    this._evictionCount = 0;
  }

  set(key, value) {
    // If key already exists, delete first to refresh insertion order (LRU)
    if (super.has(key)) {
      super.delete(key);
    }
    super.set(key, value);

    // Evict oldest entries if over limit
    while (super.size > this._maxSize) {
      const oldest = super.keys().next().value;
      super.delete(oldest);
      this._evictionCount++;
    }

    return this;
  }

  get(key) {
    if (!super.has(key)) return undefined;
    // Move to end (refresh LRU position)
    const value = super.get(key);
    super.delete(key);
    super.set(key, value);
    return value;
  }

  /** Returns eviction statistics for monitoring. */
  stats() {
    return {
      name: this._name,
      size: this.size,
      maxSize: this._maxSize,
      evictions: this._evictionCount,
      utilization: this.size / this._maxSize,
    };
  }
}

export default BoundedMap;
