'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * FE-017: UI permission gating.
 *
 * Provides a declarative way to hide or disable UI controls that require
 * backend scopes the current user may not have. Prevents the confusing UX
 * of showing a button that the backend will reject.
 *
 * Usage:
 *   <PermissionGate scope="admin:write" fallback={<span>No access</span>}>
 *     <DeleteButton />
 *   </PermissionGate>
 */

export type Scope = string; // e.g. "admin:read", "dtu:write", "council:vote"

interface PermissionContextValue {
  /** Scopes the current user has been granted. */
  scopes: Set<Scope>;
  /** Check if user has a specific scope. */
  has: (scope: Scope) => boolean;
}

const PermissionContext = createContext<PermissionContextValue>({
  scopes: new Set(),
  has: () => true, // permissive default — no gating until provider is mounted
});

/**
 * Wrap the app (or a subtree) to provide the user's scopes.
 * Scopes should come from the auth/me endpoint.
 */
export function PermissionProvider({
  scopes,
  children,
}: {
  scopes: string[];
  children: ReactNode;
}) {
  const scopeSet = new Set<Scope>(scopes);
  return (
    <PermissionContext.Provider value={{ scopes: scopeSet, has: (s) => scopeSet.has(s) }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

/**
 * Conditionally renders children only if the user has the required scope.
 */
export function PermissionGate({
  scope,
  children,
  fallback = null,
}: {
  scope: Scope;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { has } = usePermissions();
  return has(scope) ? <>{children}</> : <>{fallback}</>;
}
