import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for Next.js auth middleware.
 *
 * We test the middleware function directly by constructing
 * NextRequest-like objects and verifying the response.
 */

// Mock NextResponse and NextRequest
const makeMockHeaders = () => {
  const store = new Map<string, string>();
  return { set: vi.fn((k: string, v: string) => store.set(k, v)), get: (k: string) => store.get(k) };
};

const mockRedirect = vi.fn().mockImplementation((url: URL) => ({
  type: 'redirect',
  url: url.toString(),
  headers: makeMockHeaders(),
}));

const mockNext = vi.fn().mockImplementation(() => ({ type: 'next', headers: makeMockHeaders() }));

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => mockRedirect(url),
    next: () => mockNext(),
  },
}));

function makeRequest(pathname: string, cookies: Record<string, string> = {}) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: {
      has: (name: string) => name in cookies,
      get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined,
    },
  };
}

describe('Auth Middleware', () => {
  let middleware: (req: ReturnType<typeof makeRequest>) => unknown;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/middleware');
    middleware = mod.middleware as typeof middleware;
  });

  describe('public paths', () => {
    it('allows / (landing page) without auth', () => {
      middleware(makeRequest('/'));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('allows /login without auth', () => {
      middleware(makeRequest('/login'));
      expect(mockNext).toHaveBeenCalled();
    });

    it('allows /register without auth', () => {
      middleware(makeRequest('/register'));
      expect(mockNext).toHaveBeenCalled();
    });

    it('allows /forgot-password without auth', () => {
      middleware(makeRequest('/forgot-password'));
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('public prefixes', () => {
    it('allows /api/* requests through', () => {
      middleware(makeRequest('/api/auth/me'));
      expect(mockNext).toHaveBeenCalled();
    });

    it('allows /_next/* static assets through', () => {
      middleware(makeRequest('/_next/static/chunk.js'));
      expect(mockNext).toHaveBeenCalled();
    });

    it('allows /icons/* through', () => {
      middleware(makeRequest('/icons/icon-192x192.svg'));
      expect(mockNext).toHaveBeenCalled();
    });

    it('allows /manifest.json through', () => {
      middleware(makeRequest('/manifest.json'));
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('protected routes', () => {
    it('redirects to /login when no session cookie', () => {
      middleware(makeRequest('/hub'));
      expect(mockRedirect).toHaveBeenCalled();
      const url = mockRedirect.mock.calls[0][0];
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('from')).toBe('/hub');
    });

    it('redirects /lenses/chat to /login with from param', () => {
      middleware(makeRequest('/lenses/chat'));
      expect(mockRedirect).toHaveBeenCalled();
      const url = mockRedirect.mock.calls[0][0];
      expect(url.searchParams.get('from')).toBe('/lenses/chat');
    });

    it('allows through with concord_session cookie', () => {
      middleware(makeRequest('/hub', { concord_session: 'abc123' }));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('allows through with token cookie', () => {
      middleware(makeRequest('/lenses/graph', { token: 'jwt-token' }));
      expect(mockNext).toHaveBeenCalled();
    });

    it('allows through with connect.sid cookie', () => {
      middleware(makeRequest('/lenses/code', { 'connect.sid': 'session-id' }));
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('config', () => {
    it('exports matcher config', async () => {
      const mod = await import('@/middleware');
      expect(mod.config).toBeDefined();
      expect(mod.config.matcher).toBeInstanceOf(Array);
      expect(mod.config.matcher.length).toBeGreaterThan(0);
    });
  });
});
