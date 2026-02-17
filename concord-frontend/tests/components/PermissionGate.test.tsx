import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { PermissionProvider, PermissionGate, usePermissions } from '@/components/common/PermissionGate';
import type { ReactNode } from 'react';

describe('PermissionProvider', () => {
  it('provides scopes to children', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PermissionProvider scopes={['admin:read', 'dtu:write']}>
        {children}
      </PermissionProvider>
    );

    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(result.current.scopes.has('admin:read')).toBe(true);
    expect(result.current.scopes.has('dtu:write')).toBe(true);
    expect(result.current.scopes.has('admin:write')).toBe(false);
  });

  it('provides has() function that checks scopes', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PermissionProvider scopes={['admin:read']}>
        {children}
      </PermissionProvider>
    );

    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(result.current.has('admin:read')).toBe(true);
    expect(result.current.has('admin:write')).toBe(false);
  });
});

describe('usePermissions', () => {
  it('returns permissive default (has() returns true) when no provider', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.has('any:scope')).toBe(true);
    expect(result.current.scopes.size).toBe(0);
  });
});

describe('PermissionGate', () => {
  it('renders children when user has the required scope', () => {
    render(
      <PermissionProvider scopes={['admin:write']}>
        <PermissionGate scope="admin:write">
          <div data-testid="protected-content">Secret</div>
        </PermissionGate>
      </PermissionProvider>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('does not render children when user lacks the scope', () => {
    render(
      <PermissionProvider scopes={['admin:read']}>
        <PermissionGate scope="admin:write">
          <div data-testid="protected-content">Secret</div>
        </PermissionGate>
      </PermissionProvider>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders fallback when user lacks the scope', () => {
    render(
      <PermissionProvider scopes={['admin:read']}>
        <PermissionGate scope="admin:write" fallback={<span data-testid="fallback">No access</span>}>
          <div data-testid="protected-content">Secret</div>
        </PermissionGate>
      </PermissionProvider>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.getByText('No access')).toBeInTheDocument();
  });

  it('renders children without provider (permissive default)', () => {
    render(
      <PermissionGate scope="any:scope">
        <div data-testid="protected-content">Content</div>
      </PermissionGate>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders null fallback by default when scope is missing', () => {
    render(
      <PermissionProvider scopes={[]}>
        <PermissionGate scope="missing:scope">
          <div data-testid="protected-content">Secret</div>
        </PermissionGate>
      </PermissionProvider>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
