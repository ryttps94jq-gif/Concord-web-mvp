import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock lucide-react icons for jsdom environment
vi.mock('lucide-react', async (importOriginal) => {
  const makeMockIcon = (name: string) => {
    const Icon = React.forwardRef<SVGSVGElement, any>((props, ref) =>
      React.createElement('span', { 'data-testid': `icon-${name}`, ref, ...props })
    );
    Icon.displayName = name;
    return Icon;
  };

  return {
    __esModule: true,
    Shield: makeMockIcon('Shield'),
    ShieldCheck: makeMockIcon('ShieldCheck'),
    ShieldAlert: makeMockIcon('ShieldAlert'),
    ShieldX: makeMockIcon('ShieldX'),
    ChevronDown: makeMockIcon('ChevronDown'),
    ChevronUp: makeMockIcon('ChevronUp'),
    Archive: makeMockIcon('Archive'),
    FileCheck: makeMockIcon('FileCheck'),
  };
});

import { DTUIntegrityBadge } from '@/components/dtu/DTUIntegrityBadge';

describe('DTUIntegrityBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows green checkmark when verified', () => {
    render(
      <DTUIntegrityBadge
        dtuId="dtu-123"
        status="verified"
        contentHash="abc123def456"
        compressionRatio={0.3}
        verifiedAt="2026-02-28T10:00:00Z"
      />
    );

    const verified = screen.queryByText(/Verified/);
    expect(verified).not.toBeNull();
  });

  it('shows warning icon when unverified', () => {
    render(
      <DTUIntegrityBadge
        dtuId="dtu-456"
        status="unverified"
      />
    );

    const unverified = screen.queryByText(/Unverified/);
    expect(unverified).not.toBeNull();
  });

  it('shows red X when tampered', () => {
    render(
      <DTUIntegrityBadge
        dtuId="dtu-789"
        status="tampered"
      />
    );

    const tampered = screen.queryByText(/Tampered/);
    expect(tampered).not.toBeNull();
  });

  it('click opens integrity report', () => {
    render(
      <DTUIntegrityBadge
        dtuId="dtu-123"
        status="verified"
        contentHash="abc123def456"
        compressionRatio={0.3}
        compressionAlgorithm="gzip"
        originalSize={10000}
        compressedSize={3000}
        verifiedAt="2026-02-28T10:00:00Z"
        integrityReport={{
          dtuId: 'dtu-123',
          contentHash: 'abc123def456',
          isValid: true,
          layerChecksums: {
            layer1: 'checksum1abcdef1234567890',
            layer2: 'checksum2abcdef1234567890',
          },
        }}
      />
    );

    // Verify badge is shown
    const badge = screen.getByText('Verified');
    expect(badge).toBeDefined();

    // Click the badge to expand details
    fireEvent.click(badge);

    // Should show content hash details after expanding
    const hashLabel = screen.queryByText(/Content Hash/i);
    expect(hashLabel).not.toBeNull();
  });

  it('shows compression ratio', () => {
    render(
      <DTUIntegrityBadge
        dtuId="dtu-123"
        status="verified"
        compressionRatio={0.3}
        verifiedAt="2026-02-28T10:00:00Z"
      />
    );

    // compressionRatio=0.3 => savingsPercent = (1-0.3)*100 = 70.0% saved
    const ratio = screen.queryByText(/70\.0% saved/);
    expect(ratio).not.toBeNull();
  });

  it('handles compact mode', () => {
    render(
      <DTUIntegrityBadge
        dtuId="dtu-123"
        status="verified"
        compressionRatio={0.3}
        compact={true}
      />
    );

    // In compact mode, still shows the label
    const verified = screen.queryByText(/Verified/);
    expect(verified).not.toBeNull();

    // Also shows savings in compact mode
    const savings = screen.queryByText(/70\.0% saved/);
    expect(savings).not.toBeNull();
  });

  it('calls onVerify when unverified badge is clicked', () => {
    const onVerify = vi.fn();
    render(
      <DTUIntegrityBadge
        dtuId="dtu-123"
        status="unverified"
        onVerify={onVerify}
      />
    );

    const badge = screen.getByText('Unverified');
    fireEvent.click(badge);

    expect(onVerify).toHaveBeenCalledWith('dtu-123');
  });

  it('renders as a compact badge element', () => {
    const { container } = render(
      <DTUIntegrityBadge
        dtuId="dtu-123"
        status="verified"
      />
    );
    expect(container.firstChild).toBeDefined();
  });
});
