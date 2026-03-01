import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

import { MediaUpload } from '@/components/media/MediaUpload';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('MediaUpload', () => {
  const onUploadComplete = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.post.mockResolvedValue({
      data: { ok: true, artifactHash: 'test-hash', id: 'dtu-1' },
    });
  });

  it('renders drop zone', () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    expect(screen.getByText(/drag.*drop|click.*upload|browse/i)).toBeDefined();
  });

  it('renders accepted file type info', () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    // Should mention accepted types
    expect(screen.getByText(/audio|video|image/i)).toBeDefined();
  });

  it('shows upload progress when a file is dropped', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);

    const dropZone = screen.getByText(/drag.*drop|click.*upload|browse/i).closest('div')!;

    const file = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' });
    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    // After drop, should show some progress or file info
    await waitFor(() => {
      const progressOrFileName = screen.queryByText(/test\.mp3|uploading|progress/i);
      expect(progressOrFileName).not.toBeNull();
    });
  });

  it('metadata form fields render after file selection', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);

    const dropZone = screen.getByText(/drag.*drop|click.*upload|browse/i).closest('div')!;
    const file = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' });
    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      // Should show metadata fields like title, description
      const titleField = screen.queryByLabelText(/title/i) || screen.queryByPlaceholderText(/title/i);
      expect(titleField).not.toBeNull();
    });
  });

  it('shows description field', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);

    const dropZone = screen.getByText(/drag.*drop|click.*upload|browse/i).closest('div')!;
    const file = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' });
    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      const descField = screen.queryByLabelText(/description/i) || screen.queryByPlaceholderText(/description/i);
      expect(descField).not.toBeNull();
    });
  });

  it('privacy selector renders', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);

    const dropZone = screen.getByText(/drag.*drop|click.*upload|browse/i).closest('div')!;
    const file = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' });
    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      const privacyEl = screen.queryByText(/privacy|private|public/i);
      expect(privacyEl).not.toBeNull();
    });
  });

  it('submit calls API', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);

    const dropZone = screen.getByText(/drag.*drop|click.*upload|browse/i).closest('div')!;
    const file = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' });
    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      const submitBtn = screen.queryByText(/upload|submit/i);
      expect(submitBtn).not.toBeNull();
    });

    const submitBtn = screen.getByText(/upload|submit/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalled();
    });
  });

  it('error display on upload failure', async () => {
    mockedApi.post.mockRejectedValue(new Error('Upload failed'));

    render(<MediaUpload onUploadComplete={onUploadComplete} />);

    const dropZone = screen.getByText(/drag.*drop|click.*upload|browse/i).closest('div')!;
    const file = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' });
    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      const submitBtn = screen.queryByText(/upload|submit/i);
      if (submitBtn) fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      const errorText = screen.queryByText(/fail|error/i);
      expect(errorText).not.toBeNull();
    });
  });

  it('rejects non-accepted file types', async () => {
    render(
      <MediaUpload
        onUploadComplete={onUploadComplete}
        acceptedTypes={['audio/*']}
      />
    );

    const dropZone = screen.getByText(/drag.*drop|click.*upload|browse/i).closest('div')!;
    const file = new File(['test content'], 'test.exe', { type: 'application/x-msdownload' });
    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    // Should show error or not accept the file
    await waitFor(() => {
      const errorOrReject = screen.queryByText(/not supported|invalid|reject|file type/i);
      expect(errorOrReject).not.toBeNull();
    });
  });

  it('shows tags field', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);

    const dropZone = screen.getByText(/drag.*drop|click.*upload|browse/i).closest('div')!;
    const file = new File(['test'], 'test.mp3', { type: 'audio/mpeg' });
    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      const tagsField = screen.queryByLabelText(/tags/i) || screen.queryByPlaceholderText(/tags/i);
      expect(tagsField).not.toBeNull();
    });
  });
});
