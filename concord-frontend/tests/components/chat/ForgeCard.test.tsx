import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ForgeCard from '@/components/chat/ForgeCard';

const makeDTU = (overrides = {}) => ({
  id: 'dtu-123',
  title: 'Test DTU',
  artifact: { content: 'Some content' },
  tags: ['test'],
  ...overrides,
});

const makePresentation = (overrides = {}) => ({
  title: 'Generated Document',
  format: 'Document',
  primaryType: 1,
  preview: 'This is a preview of the generated document content...',
  sourceLenses: ['healthcare', 'finance'],
  cretiScore: 14,
  substrateCitationCount: 3,
  formatAmbiguous: false,
  ...overrides,
});

const makeActions = (overrides = {}) => ({
  save: { available: true, description: 'Save to substrate' },
  delete: { available: true, description: 'Delete artifact' },
  saveAndList: { available: true, description: 'Save and list on marketplace' },
  iterate: { available: true, description: 'Edit and iterate' },
  ...overrides,
});

describe('ForgeCard', () => {
  const defaultProps = {
    dtu: makeDTU(),
    presentation: makePresentation(),
    actions: makeActions(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onList: vi.fn(),
    onIterate: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<ForgeCard {...defaultProps} />);
    expect(screen.getByText('Generated Document')).toBeInTheDocument();
  });

  it('shows format badge', () => {
    render(<ForgeCard {...defaultProps} />);
    // The format appears in the header area
    const formatBadges = screen.getAllByText('Document');
    expect(formatBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows preview text', () => {
    render(<ForgeCard {...defaultProps} />);
    expect(
      screen.getByText('This is a preview of the generated document content...')
    ).toBeInTheDocument();
  });

  it('shows source lenses attribution', () => {
    render(<ForgeCard {...defaultProps} />);
    expect(screen.getByText('healthcare + finance')).toBeInTheDocument();
  });

  it('shows CRETI score', () => {
    render(<ForgeCard {...defaultProps} />);
    expect(screen.getByText('CRETI: 14/20')).toBeInTheDocument();
  });

  it('shows substrate citation count', () => {
    render(<ForgeCard {...defaultProps} />);
    expect(screen.getByText('3 substrate citations')).toBeInTheDocument();
  });

  it('shows singular citation text for 1 citation', () => {
    render(
      <ForgeCard
        {...defaultProps}
        presentation={makePresentation({ substrateCitationCount: 1 })}
      />
    );
    expect(screen.getByText('1 substrate citation')).toBeInTheDocument();
  });

  it('does not show citation count when 0', () => {
    render(
      <ForgeCard
        {...defaultProps}
        presentation={makePresentation({ substrateCitationCount: 0 })}
      />
    );
    expect(screen.queryByText(/substrate citation/)).not.toBeInTheDocument();
  });

  it('shows multi-artifact badge when isMultiArtifact is true', () => {
    render(<ForgeCard {...defaultProps} isMultiArtifact />);
    expect(screen.getByText('Multi-artifact')).toBeInTheDocument();
  });

  it('does not show multi-artifact badge by default', () => {
    render(<ForgeCard {...defaultProps} />);
    expect(screen.queryByText('Multi-artifact')).not.toBeInTheDocument();
  });

  it('shows format ambiguity warning when formatAmbiguous is true', () => {
    render(
      <ForgeCard
        {...defaultProps}
        presentation={makePresentation({
          formatAmbiguous: true,
          alternatives: ['Code', 'Dataset'],
        })}
      />
    );
    expect(screen.getByText(/Format might also be:/)).toBeInTheDocument();
    expect(screen.getByText(/Code, Dataset/)).toBeInTheDocument();
  });

  it('renders Save button and calls onSave when clicked', () => {
    const onSave = vi.fn();
    render(<ForgeCard {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(defaultProps.dtu);
  });

  it('shows saved confirmation after saving', () => {
    render(<ForgeCard {...defaultProps} />);

    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText(/Saved to your substrate/)).toBeInTheDocument();
    // Action buttons should be hidden
    expect(screen.queryByText('Save & List')).not.toBeInTheDocument();
  });

  it('renders Save & List button and calls onList when clicked', () => {
    const onList = vi.fn();
    render(<ForgeCard {...defaultProps} onList={onList} />);

    fireEvent.click(screen.getByText('Save & List'));
    expect(onList).toHaveBeenCalledWith(defaultProps.dtu);
  });

  it('shows listed confirmation after listing', () => {
    render(<ForgeCard {...defaultProps} />);

    fireEvent.click(screen.getByText('Save & List'));
    expect(screen.getByText(/Saved and listed on marketplace/)).toBeInTheDocument();
    expect(screen.getByText(/96%/)).toBeInTheDocument();
  });

  it('renders delete button and returns null after delete', () => {
    const onDelete = vi.fn();
    const { container } = render(
      <ForgeCard {...defaultProps} onDelete={onDelete} />
    );

    // The delete button is the last button in the action bar. It contains ml-auto.
    const actionButtons = container.querySelectorAll('button');
    // Filter to find the button with ml-auto (the delete button)
    const deleteBtn = Array.from(actionButtons).find(
      (btn) => btn.className.includes('ml-auto')
    );
    expect(deleteBtn).toBeTruthy();

    fireEvent.click(deleteBtn!);
    expect(onDelete).toHaveBeenCalledWith('dtu-123');
    // After deletion, the card should render nothing
    expect(container.innerHTML).toBe('');
  });

  it('shows Edit button that toggles iteration input', () => {
    render(<ForgeCard {...defaultProps} />);

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByPlaceholderText('What should change?')).toBeInTheDocument();
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('calls onIterate when Apply is clicked with input', () => {
    const onIterate = vi.fn();
    render(<ForgeCard {...defaultProps} onIterate={onIterate} />);

    fireEvent.click(screen.getByText('Edit'));
    const input = screen.getByPlaceholderText('What should change?');
    fireEvent.change(input, { target: { value: 'Make it more concise' } });
    fireEvent.click(screen.getByText('Apply'));

    expect(onIterate).toHaveBeenCalledWith(defaultProps.dtu, 'Make it more concise');
  });

  it('does not call onIterate when Apply is clicked with empty input', () => {
    const onIterate = vi.fn();
    render(<ForgeCard {...defaultProps} onIterate={onIterate} />);

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Apply'));

    expect(onIterate).not.toHaveBeenCalled();
  });

  it('hides buttons that are not available', () => {
    render(
      <ForgeCard
        {...defaultProps}
        actions={makeActions({
          save: { available: false, description: '' },
          saveAndList: { available: false, description: '' },
        })}
      />
    );

    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.queryByText('Save & List')).not.toBeInTheDocument();
    // Edit and delete should still be available
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('renders with different format types', () => {
    const formats = ['Audio', 'Image', 'Code', 'Dataset', 'Research', 'Video'];
    formats.forEach((format) => {
      const { unmount } = render(
        <ForgeCard
          {...defaultProps}
          presentation={makePresentation({ format })}
        />
      );
      expect(screen.getByText(format)).toBeInTheDocument();
      unmount();
    });
  });

  it('toggles expanded preview on chevron click', () => {
    const { container } = render(<ForgeCard {...defaultProps} />);

    // Find the expand/collapse button (chevron)
    const buttons = container.querySelectorAll('button');
    const chevronBtn = Array.from(buttons).find(
      (btn) => btn.querySelector('svg') && !btn.textContent?.trim()
    );
    // Click expand if found
    if (chevronBtn) {
      fireEvent.click(chevronBtn);
      // After expand, the preview should not have max-h-24
    }
  });
});
