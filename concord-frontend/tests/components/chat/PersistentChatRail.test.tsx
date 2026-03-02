import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PersistentChatRail } from '@/components/chat/PersistentChatRail';

// ── Polyfill scrollIntoView for jsdom ────────────────────────────────

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// ── Mock dependencies ────────────────────────────────────────────────

// Mock useSocket
vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    isConnected: false,
  }),
}));

// Mock useSessionId
vi.mock('@/hooks/useSessionId', () => ({
  useSessionId: () => 'test-session-123',
  resetSessionId: vi.fn(),
}));

// Mock useChatProactive
vi.mock('@/components/chat/useChatProactive', () => ({
  useChatProactive: () => ({
    proactiveMessages: [],
    resetIdleTimer: vi.fn(),
    addDTUNotification: vi.fn(),
    dismissProactive: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

// Mock useCrossLensMemory
vi.mock('@/components/chat/useCrossLensMemory', () => ({
  useCrossLensMemory: () => ({
    trail: [],
    totalLensCount: 1,
    memoryPreserved: true,
    recordMessage: vi.fn(),
    toggleMemoryPreserved: vi.fn(),
    clearTrail: vi.fn(),
  }),
}));

// Mock api client
vi.mock('@/lib/api/client', () => ({
  api: {
    post: vi.fn().mockResolvedValue({ data: { response: 'Test response' } }),
    get: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock sub-components that are already tested independently
vi.mock('@/components/sovereignty/SovereigntyPrompt', () => ({
  SovereigntyPrompt: () => <div data-testid="sovereignty-prompt">Sovereignty Prompt</div>,
}));

vi.mock('@/components/pipeline/PipelineProgress', () => ({
  PipelineProgress: () => <div data-testid="pipeline-progress">Pipeline Progress</div>,
}));

// ── Tests ────────────────────────────────────────────────────────────

describe('PersistentChatRail', () => {
  const defaultProps = {
    currentLens: 'healthcare',
    collapsed: false,
    onToggle: vi.fn(),
    onLensNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Collapsed state ────────────────────────────────────────────

  describe('collapsed state', () => {
    it('renders floating chat button when collapsed', () => {
      render(<PersistentChatRail {...defaultProps} collapsed />);
      expect(screen.getByLabelText('Open chat')).toBeInTheDocument();
    });

    it('fires onToggle when floating button is clicked', () => {
      const onToggle = vi.fn();
      render(
        <PersistentChatRail {...defaultProps} collapsed onToggle={onToggle} />
      );

      fireEvent.click(screen.getByLabelText('Open chat'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('does not show message count badge when no messages', () => {
      render(<PersistentChatRail {...defaultProps} collapsed />);
      const button = screen.getByLabelText('Open chat');
      // No badge span should exist since messages are empty
      expect(button.querySelector('span')).not.toBeInTheDocument();
    });
  });

  // ── Expanded state ─────────────────────────────────────────────

  describe('expanded state', () => {
    it('renders the chat panel header', () => {
      render(<PersistentChatRail {...defaultProps} />);
      expect(screen.getByText('Concord Chat')).toBeInTheDocument();
    });

    it('shows current lens badge in header', () => {
      render(<PersistentChatRail {...defaultProps} />);
      // 'healthcare' appears in both the header badge and the WelcomePanel
      const healthcareElements = screen.getAllByText('healthcare');
      expect(healthcareElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the mode selector', () => {
      render(<PersistentChatRail {...defaultProps} />);
      expect(screen.getByTitle('Welcome')).toBeInTheDocument();
      expect(screen.getByTitle('Assist')).toBeInTheDocument();
      expect(screen.getByTitle('Explore')).toBeInTheDocument();
      expect(screen.getByTitle('Connect')).toBeInTheDocument();
      expect(screen.getByTitle('Chat')).toBeInTheDocument();
    });

    it('has a text input area', () => {
      render(<PersistentChatRail {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Ask Concord anything...');
      expect(textarea).toBeInTheDocument();
    });

    it('has a send button', () => {
      render(<PersistentChatRail {...defaultProps} />);
      expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    });

    it('disables send button when input is empty', () => {
      render(<PersistentChatRail {...defaultProps} />);
      const sendBtn = screen.getByLabelText('Send message');
      expect(sendBtn).toBeDisabled();
    });

    it('enables send button when input has text', () => {
      render(<PersistentChatRail {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Ask Concord anything...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      const sendBtn = screen.getByLabelText('Send message');
      expect(sendBtn).not.toBeDisabled();
    });

    it('has a close button that fires onToggle', () => {
      const onToggle = vi.fn();
      render(<PersistentChatRail {...defaultProps} onToggle={onToggle} />);

      fireEvent.click(screen.getByLabelText('Close chat'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('has a new conversation button', () => {
      render(<PersistentChatRail {...defaultProps} />);
      expect(screen.getByLabelText('New conversation')).toBeInTheDocument();
    });

    it('has an expand/collapse panel button', () => {
      render(<PersistentChatRail {...defaultProps} />);
      expect(
        screen.getByLabelText('Expand chat panel')
      ).toBeInTheDocument();
    });

    it('toggles expand state when expand button is clicked', () => {
      render(<PersistentChatRail {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Expand chat panel'));
      expect(
        screen.getByLabelText('Collapse chat panel')
      ).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Collapse chat panel'));
      expect(
        screen.getByLabelText('Expand chat panel')
      ).toBeInTheDocument();
    });
  });

  // ── Mode panels ────────────────────────────────────────────────

  describe('mode panels', () => {
    it('shows WelcomePanel by default (welcome mode, 0 messages)', () => {
      render(<PersistentChatRail {...defaultProps} />);
      // WelcomePanel shows "Quick actions"
      expect(screen.getByText(/Quick actions/i)).toBeInTheDocument();
    });

    it('switches to Assist mode panel when Assist is selected', () => {
      render(<PersistentChatRail {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Assist'));
      expect(screen.getByText('Task Assistant Mode')).toBeInTheDocument();
    });

    it('switches to Explore mode panel when Explore is selected', () => {
      render(<PersistentChatRail {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Explore'));
      expect(screen.getByText('Explore Mode')).toBeInTheDocument();
    });

    it('switches to Connect mode panel when Connect is selected', () => {
      render(<PersistentChatRail {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Connect'));
      expect(screen.getByText('Connect Mode')).toBeInTheDocument();
    });

    it('shows empty state for Chat mode with 0 messages', () => {
      render(<PersistentChatRail {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Chat'));
      expect(screen.getByText('Chat with Concord')).toBeInTheDocument();
      expect(
        screen.getByText(/Context is never lost/)
      ).toBeInTheDocument();
    });
  });

  // ── Input handling ─────────────────────────────────────────────

  describe('input handling', () => {
    it('updates textarea value on change', () => {
      render(<PersistentChatRail {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Ask Concord anything...');

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      expect(textarea).toHaveValue('Test message');
    });

    it('clears input and adds user message on form submit', async () => {
      render(<PersistentChatRail {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Ask Concord anything...');

      fireEvent.change(textarea, { target: { value: 'Hello Concord' } });

      await act(async () => {
        fireEvent.submit(textarea.closest('form')!);
      });

      // Input should be cleared
      expect(textarea).toHaveValue('');
      // User message should appear
      expect(screen.getByText('Hello Concord')).toBeInTheDocument();
    });

    it('sends message on Enter key (without Shift)', async () => {
      render(<PersistentChatRail {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Ask Concord anything...');

      fireEvent.change(textarea, { target: { value: 'Test enter' } });

      await act(async () => {
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      });

      expect(textarea).toHaveValue('');
      expect(screen.getByText('Test enter')).toBeInTheDocument();
    });

    it('does not send on Shift+Enter (allows multiline)', () => {
      render(<PersistentChatRail {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Ask Concord anything...');

      fireEvent.change(textarea, { target: { value: 'Multiline' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      // Input should not be cleared
      expect(textarea).toHaveValue('Multiline');
    });

    it('does not send empty messages', async () => {
      render(<PersistentChatRail {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Ask Concord anything...');

      fireEvent.change(textarea, { target: { value: '   ' } });

      await act(async () => {
        fireEvent.submit(textarea.closest('form')!);
      });

      // Input should not be cleared since message is whitespace-only
      expect(textarea).toHaveValue('   ');
    });
  });

  // ── Mode-specific placeholders ─────────────────────────────────

  describe('mode-specific placeholders', () => {
    it('shows correct placeholder for assist mode', () => {
      render(<PersistentChatRail {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Assist'));
      expect(
        screen.getByPlaceholderText('What task can I help with?')
      ).toBeInTheDocument();
    });

    it('shows correct placeholder for explore mode', () => {
      render(<PersistentChatRail {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Explore'));
      expect(
        screen.getByPlaceholderText('What would you like to explore?')
      ).toBeInTheDocument();
    });

    it('shows correct placeholder for connect mode', () => {
      render(<PersistentChatRail {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Connect'));
      expect(
        screen.getByPlaceholderText('Start a collaborative message...')
      ).toBeInTheDocument();
    });
  });
});
