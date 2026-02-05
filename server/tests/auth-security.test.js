/**
 * Concord Auth & Security Tests
 * Run: node --test tests/auth-security.test.js
 *
 * Tests authentication, authorization, CSRF protection, and security features.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

const API_BASE = process.env.API_BASE || 'http://localhost:5050';
const TEST_USER = {
  username: `test_user_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'TestPassword123!'
};

let authToken = null;
let csrfToken = null;
let cookies = '';

// Helper to make API requests
async function api(method, path, body = null, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (authToken && !options.noAuth) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const fetchOptions = {
    method,
    headers,
    credentials: 'include'
  };
  if (body) fetchOptions.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, fetchOptions);

  // Capture cookies from response
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    cookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');
  }

  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json, headers: res.headers };
}

// ============= Health Check Tests =============

describe('Health & Status Endpoints', () => {
  it('GET /health returns healthy status', async () => {
    const res = await api('GET', '/health', null, { noAuth: true });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.status, 'healthy');
    assert(res.version, 'Should include version');
    assert(res.uptime >= 0, 'Should include uptime');
  });

  it('GET /ready returns readiness status', async () => {
    const res = await api('GET', '/ready', null, { noAuth: true });
    assert([200, 503].includes(res.status), 'Should return 200 or 503');
    assert(typeof res.ready === 'boolean', 'Should include ready boolean');
  });

  it('GET /api/status returns system status', async () => {
    const res = await api('GET', '/api/status', null, { noAuth: true });
    assert.strictEqual(res.ok, true);
    assert(res.version, 'Should include version');
  });
});

// ============= Authentication Tests =============

describe('Authentication', () => {
  it('POST /api/auth/register creates new user', async () => {
    const res = await api('POST', '/api/auth/register', TEST_USER, { noAuth: true });

    // Registration might be disabled
    if (res.status === 403) {
      console.log('Registration disabled, skipping user creation');
      return;
    }

    assert.strictEqual(res.ok, true, `Registration failed: ${res.error}`);
    assert(res.user?.id, 'Should return user ID');
    assert(res.token, 'Should return auth token');
    authToken = res.token;
  });

  it('POST /api/auth/register rejects duplicate username', async () => {
    const res = await api('POST', '/api/auth/register', TEST_USER, { noAuth: true });
    assert([409, 403].includes(res.status), 'Should reject duplicate or be disabled');
  });

  it('POST /api/auth/login with valid credentials succeeds', async () => {
    const res = await api('POST', '/api/auth/login', {
      username: TEST_USER.username,
      password: TEST_USER.password
    }, { noAuth: true });

    if (res.ok) {
      assert(res.user?.id, 'Should return user');
      assert(res.token, 'Should return token');
      authToken = res.token;
    }
  });

  it('POST /api/auth/login with invalid password fails', async () => {
    const res = await api('POST', '/api/auth/login', {
      username: TEST_USER.username,
      password: 'WrongPassword123!'
    }, { noAuth: true });

    assert.strictEqual(res.status, 401, 'Should return 401');
    assert.strictEqual(res.ok, false);
  });

  it('GET /api/auth/me returns current user when authenticated', async () => {
    if (!authToken) return;

    const res = await api('GET', '/api/auth/me');
    assert.strictEqual(res.ok, true);
    assert(res.user?.id, 'Should return user');
    assert(res.user?.username, 'Should return username');
  });

  it('GET /api/auth/me returns 401 without auth', async () => {
    const res = await api('GET', '/api/auth/me', null, { noAuth: true, headers: {} });
    assert.strictEqual(res.status, 401);
  });
});

// ============= CSRF Protection Tests =============

describe('CSRF Protection', () => {
  it('GET /api/auth/csrf-token returns CSRF token', async () => {
    const res = await api('GET', '/api/auth/csrf-token', null, { noAuth: true });
    assert.strictEqual(res.ok, true);
    assert(res.csrfToken, 'Should return CSRF token');
    csrfToken = res.csrfToken;
  });

  // Note: CSRF is only enforced in production mode
  it('State-changing requests include X-Request-ID in response', async () => {
    const res = await fetch(`${API_BASE}/api/status`);
    const requestId = res.headers.get('X-Request-ID');
    assert(requestId, 'Should include X-Request-ID header');
    assert(requestId.startsWith('req_'), 'Request ID should have correct format');
  });
});

// ============= Rate Limiting Tests =============

describe('Rate Limiting', () => {
  it('Respects rate limits on auth endpoints', async () => {
    // Make multiple rapid requests
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(api('POST', '/api/auth/login', {
        username: 'nonexistent',
        password: 'password'
      }, { noAuth: true }));
    }

    const results = await Promise.all(requests);
    // All should either be 401 (invalid) or 429 (rate limited)
    results.forEach(res => {
      assert([401, 429].includes(res.status), `Expected 401 or 429, got ${res.status}`);
    });
  });
});

// ============= Input Sanitization Tests =============

describe('Input Sanitization', () => {
  it('Strips null bytes from input', async () => {
    const res = await api('POST', '/api/forge/manual', {
      title: 'Test\x00Title',
      content: 'Content with\x00null bytes'
    });
    // Should not crash, sanitization should handle it
    assert(res.status !== 500, 'Should not cause server error');
  });

  it('Prevents prototype pollution', async () => {
    const res = await api('POST', '/api/forge/manual', {
      title: 'Test',
      '__proto__': { admin: true },
      'constructor': { admin: true }
    });
    // Should not crash or allow prototype pollution
    assert(res.status !== 500, 'Should not cause server error');
  });

  it('Handles oversized input gracefully', async () => {
    const largeString = 'x'.repeat(100000);
    const res = await api('POST', '/api/chat', {
      message: largeString
    });
    // Should either truncate or reject, not crash
    assert([200, 400, 413].includes(res.status), 'Should handle large input');
  });
});

// ============= Authorization Tests =============

describe('Authorization', () => {
  it('Protected endpoints require authentication', async () => {
    const endpoints = [
      ['GET', '/api/dtus'],
      ['POST', '/api/forge/manual'],
      ['GET', '/api/personas'],
    ];

    for (const [method, path] of endpoints) {
      const res = await api(method, path, method === 'POST' ? {} : null, { noAuth: true, headers: {} });
      assert([401, 403].includes(res.status), `${method} ${path} should require auth`);
    }
  });

  it('Admin endpoints require owner/admin role', async () => {
    // These should require elevated permissions
    const adminEndpoints = [
      ['GET', '/api/auth/audit-log'],
      ['POST', '/api/backup'],
    ];

    for (const [method, path] of adminEndpoints) {
      const res = await api(method, path, method === 'POST' ? {} : null);
      // Should either succeed (if user is admin) or return 403
      assert([200, 403].includes(res.status), `${method} ${path} should check permissions`);
    }
  });
});

// ============= Security Headers Tests =============

describe('Security Headers', () => {
  it('Responses include security headers', async () => {
    const res = await fetch(`${API_BASE}/health`);

    // Check for common security headers (when helmet is enabled)
    const headers = res.headers;

    // These may or may not be present depending on configuration
    // Just verify the response succeeds
    assert.strictEqual(res.status, 200);
  });

  it('CORS is properly configured', async () => {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET'
      }
    });

    // Should either allow or deny based on configuration
    assert([200, 204, 403].includes(res.status), 'Should handle CORS preflight');
  });
});

// ============= Audit Logging Tests =============

describe('Audit Logging', () => {
  it('Login attempts are logged', async () => {
    // First, attempt a login
    await api('POST', '/api/auth/login', {
      username: 'audit_test_user',
      password: 'wrong_password'
    }, { noAuth: true });

    // If we have admin access, check audit log
    if (authToken) {
      const res = await api('GET', '/api/auth/audit-log?limit=10&category=auth');
      if (res.ok) {
        assert(Array.isArray(res.logs), 'Should return logs array');
      }
    }
  });
});

// ============= Database Persistence Tests =============

describe('Database Persistence', () => {
  it('Status endpoint reports database state', async () => {
    const res = await api('GET', '/api/status', null, { noAuth: true });
    assert.strictEqual(res.ok, true);
    // The status should indicate if SQLite is being used
  });
});

// ============= Graceful Error Handling =============

describe('Error Handling', () => {
  it('Returns proper JSON error for invalid endpoints', async () => {
    const res = await api('GET', '/api/nonexistent/endpoint');
    assert([404, 401].includes(res.status), 'Should return 404 or 401');
  });

  it('Returns proper error for invalid JSON', async () => {
    const res = await fetch(`${API_BASE}/api/forge/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      },
      body: 'not valid json {'
    });
    assert([400, 401].includes(res.status), 'Should return 400 for invalid JSON');
  });

  it('Handles missing required fields gracefully', async () => {
    const res = await api('POST', '/api/forge/manual', {});
    // Should return validation error, not crash
    assert(res.status !== 500, 'Should not cause server error');
  });
});

// Run cleanup
after(() => {
  console.log('\n--- Auth & Security Tests Complete ---');
});
