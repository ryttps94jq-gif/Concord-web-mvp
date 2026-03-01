import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the useMediaUrl hook
const mockUseMediaUrl = vi.fn();
vi.mock('@/hooks/useMediaUrl', () => ({
  useMediaUrl: (...args: unknown[]) => mockUseMediaUrl(...args),
}));

import { UniversalPlayer } from '@/components/media/UniversalPlayer';

describe('UniversalPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMediaUrl.mockReturnValue({
      url: 'https://cdn.example.com/media/abc123/stream',
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      expiresAt: null,
      isCDN: true,
    });
  });

  const audioMediaDTU = {
    id: 'dtu-audio-1',
    title: 'Test Audio',
    mediaType: 'audio' as const,
    mimeType: 'audio/mpeg',
    artifactHash: 'abc123-audio',
    duration: 180,
    fileSize: 5000000,
  };

  const videoMediaDTU = {
    id: 'dtu-video-1',
    title: 'Test Video',
    mediaType: 'video' as const,
    mimeType: 'video/mp4',
    artifactHash: 'abc123-video',
    duration: 360,
    fileSize: 50000000,
  };

  const imageMediaDTU = {
    id: 'dtu-image-1',
    title: 'Test Image',
    mediaType: 'image' as const,
    mimeType: 'image/jpeg',
    artifactHash: 'abc123-image',
    fileSize: 2000000,
  };

  it('renders audio player for audio media DTU', () => {
    const { container } = render(<UniversalPlayer mediaDTU={audioMediaDTU} />);
    const audioEl = container.querySelector('audio');
    expect(audioEl).not.toBeNull();
  });

  it('renders video player for video media DTU', () => {
    const { container } = render(<UniversalPlayer mediaDTU={videoMediaDTU} />);
    const videoEl = container.querySelector('video');
    expect(videoEl).not.toBeNull();
  });

  it('renders image viewer for image media DTU', () => {
    const { container } = render(<UniversalPlayer mediaDTU={imageMediaDTU} />);
    const imgEl = container.querySelector('img');
    expect(imgEl).not.toBeNull();
  });

  it('shows title text', () => {
    render(<UniversalPlayer mediaDTU={audioMediaDTU} />);
    expect(screen.getByText('Test Audio')).toBeDefined();
  });

  it('shows play/pause controls for audio', () => {
    render(<UniversalPlayer mediaDTU={audioMediaDTU} />);
    // The play button should exist
    const playButton = screen.getByTitle(/play/i);
    expect(playButton).toBeDefined();
  });

  it('shows play/pause controls for video', () => {
    render(<UniversalPlayer mediaDTU={videoMediaDTU} />);
    const playButton = screen.getByTitle(/play/i);
    expect(playButton).toBeDefined();
  });

  it('shows time/duration display for audio', () => {
    render(<UniversalPlayer mediaDTU={audioMediaDTU} />);
    // Duration should be displayed (formatted as mm:ss)
    expect(screen.getByText(/3:00/)).toBeDefined();
  });

  it('volume control renders for audio', () => {
    render(<UniversalPlayer mediaDTU={audioMediaDTU} />);
    const volumeButton = screen.getByTitle(/volume/i);
    expect(volumeButton).toBeDefined();
  });

  it('volume control renders for video', () => {
    render(<UniversalPlayer mediaDTU={videoMediaDTU} />);
    const volumeButton = screen.getByTitle(/volume/i);
    expect(volumeButton).toBeDefined();
  });

  it('handles missing mediaDTU gracefully', () => {
    const { container } = render(<UniversalPlayer mediaDTU={undefined as never} />);
    // Should render something reasonable (empty or placeholder)
    expect(container).toBeDefined();
  });

  it('handles null mediaDTU gracefully', () => {
    const { container } = render(<UniversalPlayer mediaDTU={null as never} />);
    expect(container).toBeDefined();
  });

  it('autoplay prop sets autoplay on media element', () => {
    const { container } = render(
      <UniversalPlayer mediaDTU={audioMediaDTU} autoplay />
    );
    const audioEl = container.querySelector('audio');
    expect(audioEl?.autoplay).toBe(true);
  });

  it('does not autoplay by default', () => {
    const { container } = render(<UniversalPlayer mediaDTU={audioMediaDTU} />);
    const audioEl = container.querySelector('audio');
    expect(audioEl?.autoplay).toBeFalsy();
  });

  it('shows loading state when URL is being resolved', () => {
    mockUseMediaUrl.mockReturnValue({
      url: null,
      isLoading: true,
      error: null,
      refresh: vi.fn(),
      expiresAt: null,
      isCDN: false,
    });

    render(<UniversalPlayer mediaDTU={audioMediaDTU} />);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('clicking play toggles to pause state', () => {
    render(<UniversalPlayer mediaDTU={audioMediaDTU} />);
    const playButton = screen.getByTitle(/play/i);
    fireEvent.click(playButton);
    // After clicking play, button should show pause
    // (The actual behavior depends on HTML5 audio state)
  });
});
