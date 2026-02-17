import { describe, it, expect } from 'vitest';
import {
  ENDPOINT_INVENTORY,
  getInventoryPaths,
  isEndpointKnown,
  type EndpointEntry,
} from '@/lib/api/endpoint-inventory';

describe('ENDPOINT_INVENTORY', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(ENDPOINT_INVENTORY)).toBe(true);
    expect(ENDPOINT_INVENTORY.length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const entry of ENDPOINT_INVENTORY) {
      expect(entry).toHaveProperty('method');
      expect(entry).toHaveProperty('path');
      expect(entry).toHaveProperty('usedBy');
      expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(entry.method);
      expect(entry.path).toMatch(/^\/api\//);
      expect(Array.isArray(entry.usedBy)).toBe(true);
      expect(entry.usedBy.length).toBeGreaterThan(0);
    }
  });

  it('contains core system endpoints', () => {
    const paths = ENDPOINT_INVENTORY.map((e) => `${e.method} ${e.path}`);
    expect(paths).toContain('GET /api/status');
    expect(paths).toContain('GET /api/dtus');
    expect(paths).toContain('POST /api/dtus');
    expect(paths).toContain('POST /api/auth/login');
    expect(paths).toContain('POST /api/auth/logout');
    expect(paths).toContain('GET /api/auth/me');
  });

  it('contains chat endpoints', () => {
    const chatEndpoints = ENDPOINT_INVENTORY.filter((e) => e.usedBy.includes('chat'));
    expect(chatEndpoints.length).toBeGreaterThan(0);
  });

  it('contains marketplace endpoints', () => {
    const marketEndpoints = ENDPOINT_INVENTORY.filter((e) => e.usedBy.includes('marketplace'));
    expect(marketEndpoints.length).toBeGreaterThan(0);
  });

  it('has unique method+path combinations', () => {
    const combos = ENDPOINT_INVENTORY.map((e) => `${e.method} ${e.path}`);
    const uniqueCombos = new Set(combos);
    // Allow for some duplication (same path, different methods is fine)
    // But same method+path should not repeat
    expect(combos.length).toBe(uniqueCombos.size);
  });
});

describe('getInventoryPaths', () => {
  it('returns an array of "METHOD /path" strings', () => {
    const paths = getInventoryPaths();
    expect(Array.isArray(paths)).toBe(true);
    expect(paths.length).toBe(ENDPOINT_INVENTORY.length);

    for (const p of paths) {
      expect(p).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/api\//);
    }
  });

  it('includes status endpoint', () => {
    const paths = getInventoryPaths();
    expect(paths).toContain('GET /api/status');
  });
});

describe('isEndpointKnown', () => {
  it('returns true for a known endpoint', () => {
    expect(isEndpointKnown('GET', '/api/status')).toBe(true);
    expect(isEndpointKnown('POST', '/api/dtus')).toBe(true);
  });

  it('is case-insensitive for method', () => {
    expect(isEndpointKnown('get', '/api/status')).toBe(true);
    expect(isEndpointKnown('post', '/api/dtus')).toBe(true);
  });

  it('returns false for an unknown endpoint', () => {
    expect(isEndpointKnown('GET', '/api/nonexistent')).toBe(false);
    expect(isEndpointKnown('DELETE', '/api/status')).toBe(false);
  });

  it('normalizes UUID-like path segments to :id', () => {
    // Path with a UUID segment should match against :id pattern
    expect(isEndpointKnown('PATCH', '/api/dtus/550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('normalizes shorter hex IDs', () => {
    // 8+ character hex-like segments are normalized
    expect(isEndpointKnown('GET', '/api/whiteboard/abcdef01')).toBe(true);
  });
});
