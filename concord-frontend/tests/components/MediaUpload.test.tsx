import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock lucide-react — use explicit named exports instead of Proxy
// (Proxy-based mock causes vitest to hang during module collection)
vi.mock('lucide-react', () => {
  const createIcon = (name: string) => {
    const Component = (props: any) => {
      const React = require('react');
      return React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
    };
    Component.displayName = name;
    return Component;
  };
  return {
    Upload: createIcon('Upload'),
    X: createIcon('X'),
    File: createIcon('File'),
    Image: createIcon('Image'),
    Music: createIcon('Music'),
    Video: createIcon('Video'),
    FileText: createIcon('FileText'),
    Radio: createIcon('Radio'),
    Tag: createIcon('Tag'),
    Lock: createIcon('Lock'),
    Globe: createIcon('Globe'),
    Users: createIcon('Users'),
    Loader2: createIcon('Loader2'),
    CheckCircle2: createIcon('CheckCircle2'),
    AlertCircle: createIcon('AlertCircle'),
    ChevronDown: createIcon('ChevronDown'),
    Plus: createIcon('Plus'),
  };
});

// Mock framer-motion to render plain DOM elements
vi.mock('framer-motion', () => {
  const React = require('react');
  const createMotionComponent = (tag: string) => {
    const Comp = React.forwardRef((props: any, ref: any) => {
      const {
        initial, animate, exit, transition, whileHover, whileTap, whileFocus,
        whileInView, whileDrag, variants, layout, layoutId, onAnimationComplete,
        onAnimationStart, drag, dragConstraints, dragElastic,
        ...rest
      } = props;
      return React.createElement(tag, { ...rest, ref });
    });
    Comp.displayName = `motion.${tag}`;
    return Comp;
  };
  return {
    motion: {
      div: createMotionComponent('div'),
      span: createMotionComponent('span'),
      button: createMotionComponent('button'),
      a: createMotionComponent('a'),
      p: createMotionComponent('p'),
      section: createMotionComponent('section'),
      input: createMotionComponent('input'),
    },
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock @tanstack/react-query — capture mutationFn so tests can trigger it
let capturedMutationOpts: any = null;
vi.mock('@tanstack/react-query', () => ({
  useMutation: (opts: any) => {
    capturedMutationOpts = opts;
    return {
      mutate: () => {
        opts.mutationFn().then(
          (data: any) => opts.onSuccess?.(data),
          (err: any) => opts.onError?.(err),
        );
      },
      mutateAsync: opts.mutationFn,
      isLoading: false,
      isPending: false,
      isError: false,
      isSuccess: false,
      reset: vi.fn(),
    };
  },
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => children,
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

  beforeEach(() => {
    vi.clearAllMocks();
    capturedMutationOpts = null;
    mockedApi.post.mockResolvedValue({
      data: { ok: true, artifactHash: 'test-hash', id: 'dtu-1' },
    });
  });

  function dropFile(
    dropZone: Element,
    fileName: string,
    type: string,
    sizeOverride?: number,
  ) {
    const file = new File(['test content'], fileName, { type });
    if (sizeOverride !== undefined) {
      Object.defineProperty(file, 'size', { value: sizeOverride });
    }
    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    };
    fireEvent.drop(dropZone, { dataTransfer });
    return file;
  }

  function getDropZone() {
    return screen.getByText(/drag.*drop/i).closest('div')!;
  }

  it('renders drop zone', () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    expect(screen.getByText(/drag.*drop/i)).toBeDefined();
  });

  it('renders accepted file type info', () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    // The component renders media type labels (audio, video, image, etc.) in the drop zone
    expect(screen.getByText('audio')).toBeDefined();
    expect(screen.getByText('video')).toBeDefined();
    expect(screen.getByText('image')).toBeDefined();
  });

  it('shows file name when a file is dropped', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    dropFile(getDropZone(), 'test.mp3', 'audio/mpeg');

    await waitFor(() => {
      expect(screen.queryByText('test.mp3')).not.toBeNull();
    });
  });

  it('metadata form fields render after file selection', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    dropFile(getDropZone(), 'test.mp3', 'audio/mpeg');

    await waitFor(() => {
      // Component uses <label>Title *</label> and a placeholder on the input
      const titleField = screen.queryByPlaceholderText(/title/i);
      expect(titleField).not.toBeNull();
    });
  });

  it('shows description field', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    dropFile(getDropZone(), 'test.mp3', 'audio/mpeg');

    await waitFor(() => {
      const descField = screen.queryByPlaceholderText(/describe/i);
      expect(descField).not.toBeNull();
    });
  });

  it('privacy selector renders', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    dropFile(getDropZone(), 'test.mp3', 'audio/mpeg');

    await waitFor(() => {
      // The component shows a Privacy label and a Public selector
      const privacyEl = screen.queryByText('Privacy');
      expect(privacyEl).not.toBeNull();
    });
  });

  it('submit calls API', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    dropFile(getDropZone(), 'test.mp3', 'audio/mpeg');

    await waitFor(() => {
      // The Upload button appears in the actions bar
      const uploadBtn = screen.queryByText('Upload');
      expect(uploadBtn).not.toBeNull();
    });

    // Click the Upload button
    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalled();
    });
  });

  it('error display on upload failure', async () => {
    mockedApi.post.mockRejectedValue(new Error('Upload failed'));

    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    dropFile(getDropZone(), 'test.mp3', 'audio/mpeg');

    await waitFor(() => {
      expect(screen.queryByText('Upload')).not.toBeNull();
    });

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(screen.queryByText(/Upload failed/i)).not.toBeNull();
    });
  });

  it('rejects oversized files with an error', async () => {
    // Image max size is 50 MB; provide a file with reported size > 50 MB
    render(
      <MediaUpload
        onUploadComplete={onUploadComplete}
        defaultMediaType="image"
      />
    );

    dropFile(getDropZone(), 'huge.jpg', 'image/jpeg', 60 * 1024 * 1024);

    await waitFor(() => {
      expect(screen.queryByText(/exceeds maximum size/i)).not.toBeNull();
    });
  });

  it('shows tags field', async () => {
    render(<MediaUpload onUploadComplete={onUploadComplete} />);
    dropFile(getDropZone(), 'test.mp3', 'audio/mpeg');

    await waitFor(() => {
      const tagsLabel = screen.queryByText('Tags');
      expect(tagsLabel).not.toBeNull();
    });
  });
});
