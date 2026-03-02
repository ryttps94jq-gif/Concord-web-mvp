import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AtlasOverlay from '@/components/chat/AtlasOverlay';

describe('AtlasOverlay', () => {
  it('renders loading state', () => {
    render(<AtlasOverlay query="What is here?" result={null} loading />);
    expect(screen.getByText('Querying Atlas...')).toBeInTheDocument();
  });

  it('returns null when result is null and not loading', () => {
    const { container } = render(
      <AtlasOverlay query="What is here?" result={null} loading={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows error state when result.ok is false', () => {
    render(
      <AtlasOverlay
        query="What is here?"
        result={{ ok: false }}
        loading={false}
      />
    );
    expect(
      screen.getByText('No atlas data for this location')
    ).toBeInTheDocument();
  });

  it('renders material query result with confidence', () => {
    render(
      <AtlasOverlay
        query="What material is at 40.7, -74.0?"
        result={{
          ok: true,
          material: 'concrete',
          confidence: 0.92,
          resolution_cm: 15,
        }}
      />
    );
    expect(screen.getByText('concrete')).toBeInTheDocument();
    expect(screen.getByText('92% confidence')).toBeInTheDocument();
    expect(screen.getByText('15cm res')).toBeInTheDocument();
  });

  it('renders material without confidence when not provided', () => {
    render(
      <AtlasOverlay
        query="material?"
        result={{ ok: true, material: 'wood' }}
      />
    );
    expect(screen.getByText('wood')).toBeInTheDocument();
    expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
  });

  it('renders material without resolution when not provided', () => {
    render(
      <AtlasOverlay
        query="material?"
        result={{ ok: true, material: 'glass', confidence: 0.75 }}
      />
    );
    expect(screen.getByText('glass')).toBeInTheDocument();
    expect(screen.queryByText(/cm res/)).not.toBeInTheDocument();
  });

  it('renders different material types', () => {
    const materials = ['air', 'concrete', 'wood', 'metal', 'glass', 'water', 'soil', 'rock', 'vegetation', 'unknown'];
    materials.forEach((material) => {
      const { unmount } = render(
        <AtlasOverlay
          query="material?"
          result={{ ok: true, material }}
        />
      );
      expect(screen.getByText(material)).toBeInTheDocument();
      unmount();
    });
  });

  it('renders tile query result', () => {
    render(
      <AtlasOverlay
        query="tile info"
        result={{
          ok: true,
          tile: {
            id: 'tile-1',
            coordinates: { lat_min: 40.7, lat_max: 40.8, lng_min: -74.0, lng_max: -73.9 },
            layers: {
              surface: { dominantMaterial: 'concrete' },
              subsurface: { dominantMaterial: 'soil' },
            },
          },
        }}
      />
    );
    expect(screen.getByText('Atlas Tile')).toBeInTheDocument();
    expect(screen.getByText('surface')).toBeInTheDocument();
    expect(screen.getByText('concrete')).toBeInTheDocument();
    expect(screen.getByText('subsurface')).toBeInTheDocument();
    expect(screen.getByText('soil')).toBeInTheDocument();
  });

  it('renders tile with empty layers', () => {
    render(
      <AtlasOverlay
        query="tile info"
        result={{
          ok: true,
          tile: {
            id: 'tile-2',
            coordinates: { lat_min: 0, lat_max: 0, lng_min: 0, lng_max: 0 },
            layers: {},
          },
        }}
      />
    );
    expect(screen.getByText('Atlas Tile')).toBeInTheDocument();
  });

  it('returns null when result is ok but has no material or tile', () => {
    const { container } = render(
      <AtlasOverlay query="empty?" result={{ ok: true }} />
    );
    expect(container.innerHTML).toBe('');
  });
});
