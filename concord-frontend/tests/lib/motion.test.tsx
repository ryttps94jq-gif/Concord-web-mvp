import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  fadeIn,
  slideUp,
  slideIn,
  scaleIn,
  staggerContainer,
  staggerItem,
  pulseGlow,
  PageTransition,
  StaggerList,
  StaggerItem,
  StaggerList as StaggerListComponent,
  AnimatedCard,
  Presence,
  AnimatedNumber,
  BreathingGlow,
  SlidePanel,
  Collapse,
  FloatingButton,
  Shake,
  SuccessCheck,
} from '@/lib/motion';

describe('motion module', () => {
  describe('animation variant constants', () => {
    describe('fadeIn', () => {
      it('has hidden, visible, and exit states', () => {
        expect(fadeIn).toHaveProperty('hidden');
        expect(fadeIn).toHaveProperty('visible');
        expect(fadeIn).toHaveProperty('exit');
      });

      it('hidden state has opacity 0', () => {
        expect(fadeIn.hidden).toEqual({ opacity: 0 });
      });

      it('visible state has opacity 1 with transition', () => {
        expect(fadeIn.visible).toEqual({
          opacity: 1,
          transition: { duration: 0.2 },
        });
      });

      it('exit state has opacity 0 with transition', () => {
        expect(fadeIn.exit).toEqual({
          opacity: 0,
          transition: { duration: 0.15 },
        });
      });
    });

    describe('slideUp', () => {
      it('has hidden, visible, and exit states', () => {
        expect(slideUp).toHaveProperty('hidden');
        expect(slideUp).toHaveProperty('visible');
        expect(slideUp).toHaveProperty('exit');
      });

      it('hidden state moves element down', () => {
        expect(slideUp.hidden).toEqual({ opacity: 0, y: 20 });
      });

      it('visible state resets position', () => {
        expect(slideUp.visible).toEqual({
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: 'easeOut' },
        });
      });

      it('exit state moves element up', () => {
        expect(slideUp.exit).toEqual({
          opacity: 0,
          y: -10,
          transition: { duration: 0.2 },
        });
      });
    });

    describe('slideIn', () => {
      it('has hidden, visible, and exit states', () => {
        expect(slideIn).toHaveProperty('hidden');
        expect(slideIn).toHaveProperty('visible');
        expect(slideIn).toHaveProperty('exit');
      });

      it('hidden state moves element left', () => {
        expect(slideIn.hidden).toEqual({ opacity: 0, x: -20 });
      });

      it('visible state resets position', () => {
        expect(slideIn.visible).toEqual({
          opacity: 1,
          x: 0,
          transition: { duration: 0.3, ease: 'easeOut' },
        });
      });

      it('exit state moves element right', () => {
        expect(slideIn.exit).toEqual({
          opacity: 0,
          x: 20,
          transition: { duration: 0.2 },
        });
      });
    });

    describe('scaleIn', () => {
      it('has hidden, visible, and exit states', () => {
        expect(scaleIn).toHaveProperty('hidden');
        expect(scaleIn).toHaveProperty('visible');
        expect(scaleIn).toHaveProperty('exit');
      });

      it('hidden state scales down', () => {
        expect(scaleIn.hidden).toEqual({ opacity: 0, scale: 0.95 });
      });

      it('visible state scales to full', () => {
        expect(scaleIn.visible).toEqual({
          opacity: 1,
          scale: 1,
          transition: { duration: 0.2, ease: 'easeOut' },
        });
      });

      it('exit state scales down', () => {
        expect(scaleIn.exit).toEqual({
          opacity: 0,
          scale: 0.95,
          transition: { duration: 0.15 },
        });
      });
    });

    describe('staggerContainer', () => {
      it('has hidden and visible states', () => {
        expect(staggerContainer).toHaveProperty('hidden');
        expect(staggerContainer).toHaveProperty('visible');
      });

      it('hidden state has opacity 0', () => {
        expect(staggerContainer.hidden).toEqual({ opacity: 0 });
      });

      it('visible state has stagger and delay children', () => {
        expect(staggerContainer.visible).toEqual({
          opacity: 1,
          transition: { staggerChildren: 0.05, delayChildren: 0.1 },
        });
      });
    });

    describe('staggerItem', () => {
      it('has hidden and visible states', () => {
        expect(staggerItem).toHaveProperty('hidden');
        expect(staggerItem).toHaveProperty('visible');
      });

      it('hidden state moves element down slightly', () => {
        expect(staggerItem.hidden).toEqual({ opacity: 0, y: 10 });
      });

      it('visible state resets position', () => {
        expect(staggerItem.visible).toEqual({
          opacity: 1,
          y: 0,
          transition: { duration: 0.2 },
        });
      });
    });

    describe('pulseGlow', () => {
      it('has idle and pulse states', () => {
        expect(pulseGlow).toHaveProperty('idle');
        expect(pulseGlow).toHaveProperty('pulse');
      });

      it('idle state has no box shadow', () => {
        expect(pulseGlow.idle).toEqual({
          boxShadow: '0 0 0 0 rgba(0, 255, 255, 0)',
        });
      });

      it('pulse state has animated box shadow with repeat', () => {
        const pulse = pulseGlow.pulse as {
          boxShadow: string[];
          transition: { duration: number; repeat: number };
        };
        expect(pulse.boxShadow).toHaveLength(2);
        expect(pulse.transition.duration).toBe(1);
        expect(pulse.transition.repeat).toBe(Infinity);
      });
    });
  });

  describe('PageTransition component', () => {
    it('renders children', () => {
      render(
        <PageTransition>
          <span data-testid="page-child">Page content</span>
        </PageTransition>
      );
      expect(screen.getByTestId('page-child')).toBeInTheDocument();
      expect(screen.getByText('Page content')).toBeInTheDocument();
    });
  });

  describe('StaggerList component', () => {
    it('renders children', () => {
      render(
        <StaggerList>
          <div data-testid="list-item">Item 1</div>
        </StaggerList>
      );
      expect(screen.getByTestId('list-item')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <StaggerList className="custom-class">
          <div>Content</div>
        </StaggerList>
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('StaggerItem component', () => {
    it('renders children', () => {
      render(
        <StaggerList>
          <StaggerItem>
            <span data-testid="stagger-child">Item</span>
          </StaggerItem>
        </StaggerList>
      );
      expect(screen.getByTestId('stagger-child')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <StaggerList>
          <StaggerItem className="item-class">
            <span>Item</span>
          </StaggerItem>
        </StaggerList>
      );
      // StaggerItem wraps in a motion.div
      const staggerDiv = container.querySelector('.item-class');
      expect(staggerDiv).toBeInTheDocument();
    });
  });

  describe('AnimatedCard component', () => {
    it('renders children', () => {
      render(
        <AnimatedCard>
          <span data-testid="card-child">Card content</span>
        </AnimatedCard>
      );
      expect(screen.getByTestId('card-child')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <AnimatedCard className="card-class">
          <span>Content</span>
        </AnimatedCard>
      );
      expect(container.querySelector('.card-class')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();

      render(
        <AnimatedCard onClick={handleClick}>
          <span data-testid="clickable-card">Click me</span>
        </AnimatedCard>
      );

      fireEvent.click(screen.getByTestId('clickable-card'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders without onClick', () => {
      render(
        <AnimatedCard>
          <span>No click handler</span>
        </AnimatedCard>
      );
      expect(screen.getByText('No click handler')).toBeInTheDocument();
    });
  });

  describe('Presence component', () => {
    it('renders children when show is true', () => {
      render(
        <Presence show={true}>
          <span data-testid="visible">Visible</span>
        </Presence>
      );
      expect(screen.getByTestId('visible')).toBeInTheDocument();
    });

    it('does not render children when show is false', () => {
      render(
        <Presence show={false}>
          <span data-testid="hidden">Hidden</span>
        </Presence>
      );
      expect(screen.queryByTestId('hidden')).not.toBeInTheDocument();
    });

    it('accepts mode prop', () => {
      render(
        <Presence show={true} mode="sync">
          <span data-testid="sync-content">Sync mode</span>
        </Presence>
      );
      expect(screen.getByTestId('sync-content')).toBeInTheDocument();
    });

    it('defaults to wait mode', () => {
      // Should render without error with default mode
      render(
        <Presence show={true}>
          <span>Default mode</span>
        </Presence>
      );
      expect(screen.getByText('Default mode')).toBeInTheDocument();
    });
  });

  describe('AnimatedNumber component', () => {
    it('renders the formatted number value', () => {
      render(<AnimatedNumber value={1234} />);
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('renders zero', () => {
      render(<AnimatedNumber value={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <AnimatedNumber value={42} className="number-class" />
      );
      expect(container.querySelector('.number-class')).toBeInTheDocument();
    });

    it('formats large numbers with locale string', () => {
      render(<AnimatedNumber value={1000000} />);
      expect(screen.getByText('1,000,000')).toBeInTheDocument();
    });
  });

  describe('BreathingGlow component', () => {
    it('renders children when active', () => {
      render(
        <BreathingGlow active={true}>
          <span data-testid="glow-child">Glowing</span>
        </BreathingGlow>
      );
      expect(screen.getByTestId('glow-child')).toBeInTheDocument();
    });

    it('renders children when inactive', () => {
      render(
        <BreathingGlow active={false}>
          <span data-testid="no-glow">Not glowing</span>
        </BreathingGlow>
      );
      expect(screen.getByTestId('no-glow')).toBeInTheDocument();
    });
  });

  describe('SlidePanel component', () => {
    it('renders children when open', () => {
      render(
        <SlidePanel open={true}>
          <span data-testid="panel-content">Panel</span>
        </SlidePanel>
      );
      expect(screen.getByTestId('panel-content')).toBeInTheDocument();
    });

    it('does not render children when closed', () => {
      render(
        <SlidePanel open={false}>
          <span data-testid="panel-content">Panel</span>
        </SlidePanel>
      );
      expect(screen.queryByTestId('panel-content')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <SlidePanel open={true} className="slide-class">
          <span>Content</span>
        </SlidePanel>
      );
      expect(container.querySelector('.slide-class')).toBeInTheDocument();
    });

    it('renders with side=left', () => {
      render(
        <SlidePanel open={true} side="left">
          <span data-testid="left-panel">Left panel</span>
        </SlidePanel>
      );
      expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    });

    it('defaults to side=right', () => {
      render(
        <SlidePanel open={true}>
          <span data-testid="right-panel">Right panel</span>
        </SlidePanel>
      );
      expect(screen.getByTestId('right-panel')).toBeInTheDocument();
    });
  });

  describe('Collapse component', () => {
    it('renders children when open', () => {
      render(
        <Collapse open={true}>
          <span data-testid="collapse-content">Expanded</span>
        </Collapse>
      );
      expect(screen.getByTestId('collapse-content')).toBeInTheDocument();
    });

    it('does not render children when closed', () => {
      render(
        <Collapse open={false}>
          <span data-testid="collapse-content">Collapsed</span>
        </Collapse>
      );
      expect(screen.queryByTestId('collapse-content')).not.toBeInTheDocument();
    });
  });

  describe('FloatingButton component', () => {
    it('renders children', () => {
      render(
        <FloatingButton onClick={() => {}}>
          <span data-testid="fab-child">+</span>
        </FloatingButton>
      );
      expect(screen.getByTestId('fab-child')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();

      render(
        <FloatingButton onClick={handleClick}>Click</FloatingButton>
      );

      fireEvent.click(screen.getByText('Click'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies custom className', () => {
      const { container } = render(
        <FloatingButton onClick={() => {}} className="fab-class">
          FAB
        </FloatingButton>
      );
      expect(container.querySelector('.fab-class')).toBeInTheDocument();
    });
  });

  describe('Shake component', () => {
    it('renders children with trigger=true', () => {
      render(
        <Shake trigger={true}>
          <span data-testid="shake-content">Shaking</span>
        </Shake>
      );
      expect(screen.getByTestId('shake-content')).toBeInTheDocument();
    });

    it('renders children with trigger=false', () => {
      render(
        <Shake trigger={false}>
          <span data-testid="shake-still">Still</span>
        </Shake>
      );
      expect(screen.getByTestId('shake-still')).toBeInTheDocument();
    });
  });

  describe('SuccessCheck component', () => {
    it('renders SVG when show is true', () => {
      const { container } = render(<SuccessCheck show={true} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('does not render SVG when show is false', () => {
      const { container } = render(<SuccessCheck show={false} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });

    it('SVG has correct class and viewBox', () => {
      const { container } = render(<SuccessCheck show={true} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-green-500');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });
  });

  describe('re-exports', () => {
    it('re-exports motion from framer-motion', async () => {
      const { motion } = await import('@/lib/motion');
      expect(motion).toBeDefined();
      expect(motion.div).toBeDefined();
    });

    it('re-exports AnimatePresence from framer-motion', async () => {
      const { AnimatePresence } = await import('@/lib/motion');
      expect(AnimatePresence).toBeDefined();
    });
  });
});
