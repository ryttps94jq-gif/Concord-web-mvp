import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Auth + CSP middleware — enforces authentication and sets Content-Security-Policy
 * with a per-request nonce for script integrity.
 */

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
]);

const PUBLIC_PREFIXES = [
  '/api/',
  '/_next/',
  '/icons/',
  '/manifest.json',
  '/robots.txt',
  '/favicon.ico',
];

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:5050';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${apiUrl} ${socketUrl} ws: wss:`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set('Content-Security-Policy', buildCspHeader(nonce));
  response.headers.set('x-nonce', nonce);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = generateNonce();

  // Allow public paths through
  if (PUBLIC_PATHS.has(pathname)) {
    return applySecurityHeaders(NextResponse.next(), nonce);
  }

  // Allow public prefixes through
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return applySecurityHeaders(NextResponse.next(), nonce);
  }

  // Check for session cookie (httpOnly cookie set by backend on login)
  const hasSession =
    request.cookies.has('concord_auth') ||
    request.cookies.has('concord_refresh') ||
    request.cookies.has('concord_session') ||
    request.cookies.has('token') ||
    request.cookies.has('connect.sid');

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return applySecurityHeaders(NextResponse.next(), nonce);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images.
     * This ensures middleware runs on page navigations but not on
     * static asset requests (which Next.js handles separately).
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/).*)',
  ],
};
