/**
 * LOAF II.2 — Sharded Stores
 *
 * Shard by: instance, lens, domain
 *
 * Stores:
 * - experience
 * - transfer patterns
 * - world model
 * - disputes
 * - audit logs
 *
 * No global locks.
 */

/**
 * A ShardedStore provides partitioned storage with no global locks.
 * Each shard is an independent Map with its own operations.
 */
class ShardedStore {
  constructor(name, shardKeyFn) {
    this.name = name;
    this.shardKeyFn = shardKeyFn || defaultShardKey;
    this.shards = new Map();  // shardKey -> Map(itemId -> item)
    this.stats = { reads: 0, writes: 0, deletes: 0, shardCount: 0 };
  }

  /**
   * Get or create a shard.
   */
  _getShard(shardKey) {
    if (!this.shards.has(shardKey)) {
      this.shards.set(shardKey, new Map());
      this.stats.shardCount = this.shards.size;
    }
    return this.shards.get(shardKey);
  }

  /**
   * Compute shard key for an item.
   */
  _shardKeyFor(item) {
    return this.shardKeyFn(item);
  }

  /**
   * Put an item into the appropriate shard.
   */
  put(itemId, item) {
    const key = this._shardKeyFor(item);
    const shard = this._getShard(key);
    shard.set(itemId, item);
    this.stats.writes++;
    return { ok: true, shardKey: key, itemId };
  }

  /**
   * Get an item by ID. Must specify shard key or scan all shards.
   */
  get(itemId, shardKey = null) {
    this.stats.reads++;
    if (shardKey) {
      const shard = this.shards.get(shardKey);
      return shard ? shard.get(itemId) || null : null;
    }
    // Scan all shards (no global lock, but O(shards))
    for (const shard of this.shards.values()) {
      if (shard.has(itemId)) return shard.get(itemId);
    }
    return null;
  }

  /**
   * Delete an item.
   */
  delete(itemId, shardKey = null) {
    this.stats.deletes++;
    if (shardKey) {
      const shard = this.shards.get(shardKey);
      if (shard) return shard.delete(itemId);
      return false;
    }
    for (const shard of this.shards.values()) {
      if (shard.delete(itemId)) return true;
    }
    return false;
  }

  /**
   * Query a specific shard.
   */
  queryShard(shardKey, filterFn = null, limit = 100) {
    const shard = this.shards.get(shardKey);
    if (!shard) return [];
    let items = Array.from(shard.values());
    if (filterFn) items = items.filter(filterFn);
    return items.slice(0, limit);
  }

  /**
   * Get all shard keys.
   */
  listShards() {
    return Array.from(this.shards.keys());
  }

  /**
   * Get total item count across all shards.
   */
  totalSize() {
    let total = 0;
    for (const shard of this.shards.values()) total += shard.size;
    return total;
  }

  /**
   * Get shard sizes for monitoring.
   */
  shardSizes() {
    const sizes = {};
    for (const [key, shard] of this.shards) {
      sizes[key] = shard.size;
    }
    return sizes;
  }

  /**
   * Export the store for persistence/federation.
   */
  export() {
    const data = {};
    for (const [key, shard] of this.shards) {
      data[key] = Array.from(shard.entries());
    }
    return { name: this.name, shards: data, stats: { ...this.stats } };
  }

  /**
   * Import data from an export.
   */
  import(data) {
    if (!data?.shards) return { ok: false, error: "invalid_data" };
    let imported = 0;
    for (const [key, entries] of Object.entries(data.shards)) {
      const shard = this._getShard(key);
      for (const [itemId, item] of entries) {
        shard.set(itemId, item);
        imported++;
      }
    }
    this.stats.writes += imported;
    return { ok: true, imported };
  }
}

/**
 * Default shard key function: shard by domain or "default".
 */
function defaultShardKey(item) {
  return item?.domain || item?.shard || item?.lens || "default";
}

/**
 * Shard by instance.
 */
function instanceShardKey(item) {
  return item?.instanceId || item?.instance || "default";
}

/**
 * Shard by lens.
 */
function lensShardKey(item) {
  return item?.lens || item?.lensId || "default";
}

/**
 * Shard by domain.
 */
function domainShardKey(item) {
  return item?.domain || "general";
}

// Pre-built stores for the LOAF specification
const stores = {
  experience: new ShardedStore("experience", domainShardKey),
  transferPatterns: new ShardedStore("transferPatterns", domainShardKey),
  worldModel: new ShardedStore("worldModel", domainShardKey),
  disputes: new ShardedStore("disputes", domainShardKey),
  auditLogs: new ShardedStore("auditLogs", instanceShardKey),
};

function init({ register, STATE, helpers: _helpers }) {
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.shardedStores = {
    storeNames: Object.keys(stores),
  };

  register("loaf.stores", "status", (_ctx) => {
    const summary = {};
    for (const [name, store] of Object.entries(stores)) {
      summary[name] = {
        totalItems: store.totalSize(),
        shardCount: store.shards.size,
        shardSizes: store.shardSizes(),
        stats: { ...store.stats },
      };
    }
    return { ok: true, stores: summary };
  }, { public: true });

  register("loaf.stores", "put", (_ctx, input = {}) => {
    const storeName = String(input.store || "");
    const store = stores[storeName];
    if (!store) return { ok: false, error: `unknown store: ${storeName}` };
    return store.put(String(input.itemId || `item_${Date.now()}`), input.item);
  }, { public: false });

  register("loaf.stores", "get", (_ctx, input = {}) => {
    const storeName = String(input.store || "");
    const store = stores[storeName];
    if (!store) return { ok: false, error: `unknown store: ${storeName}` };
    const item = store.get(String(input.itemId || ""), input.shardKey || null);
    return item ? { ok: true, item } : { ok: false, error: "not_found" };
  }, { public: true });

  register("loaf.stores", "query_shard", (_ctx, input = {}) => {
    const storeName = String(input.store || "");
    const store = stores[storeName];
    if (!store) return { ok: false, error: `unknown store: ${storeName}` };
    const items = store.queryShard(String(input.shardKey || "default"), null, Number(input.limit || 100));
    return { ok: true, items, count: items.length };
  }, { public: true });

  register("loaf.stores", "list_shards", (_ctx, input = {}) => {
    const storeName = String(input.store || "");
    const store = stores[storeName];
    if (!store) return { ok: false, error: `unknown store: ${storeName}` };
    return { ok: true, shards: store.listShards(), sizes: store.shardSizes() };
  }, { public: true });

  register("loaf.stores", "export", (_ctx, input = {}) => {
    const storeName = String(input.store || "");
    const store = stores[storeName];
    if (!store) return { ok: false, error: `unknown store: ${storeName}` };
    return { ok: true, data: store.export() };
  }, { public: false });

  register("loaf.stores", "import", (_ctx, input = {}) => {
    const storeName = String(input.store || "");
    const store = stores[storeName];
    if (!store) return { ok: false, error: `unknown store: ${storeName}` };
    return store.import(input.data);
  }, { public: false });
}

export {
  ShardedStore,
  defaultShardKey,
  instanceShardKey,
  lensShardKey,
  domainShardKey,
  stores,
  init,
};
