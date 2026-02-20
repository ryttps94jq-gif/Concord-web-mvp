import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Auth middleware — enforces authentication at the routing layer.
 *
 * Checks for the presence of the session cookie (set by the backend on login).
 * If missing on a protected route, redirects to /login.
 * Public routes (login, register, landing, API, static assets) are allowed through.
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Allow public prefixes through
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Check for session cookie (httpOnly cookie set by backend on login)
  // The backend sets 'concord_auth' (httpOnly JWT) and optionally 'concord_refresh'
  const hasSession =
    request.cookies.has('concord_auth') ||          // JWT auth cookie (primary — set by backend on login)
    request.cookies.has('concord_refresh') ||        // Refresh token cookie
    request.cookies.has('concord_session') ||        // Legacy fallback
    request.cookies.has('token') ||                  // Legacy fallback
    request.cookies.has('connect.sid');              // Express session fallback

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
