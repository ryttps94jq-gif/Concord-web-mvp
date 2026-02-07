'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
  Network,
  Keyboard,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Concord',
    description: 'Your local-first cognitive engine for thought synthesis. All your data stays on your machine.',
    icon: Brain
  },
  {
    id: 'create-first-dtu',
    title: 'Create Your First Thought',
    description: 'DTUs (Discrete Thought Units) are atomic pieces of knowledge. Press Cmd+N to create your first one!',
    icon: Sparkles,
    action: 'createDTU'
  },
  {
    id: 'explore-graph',
    title: 'Explore the Graph',
    description: 'See how your thoughts connect in the interactive graph view. Press Cmd+G to open it.',
    icon: Network,
    action: 'openGraph'
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Master the Shortcuts',
    description: 'Press Cmd+K to open the command palette anytime. Speed through your workflow!',
    icon: Keyboard,
    action: 'openCommandPalette'
  },
  {
    id: 'ready',
    title: "You're Ready!",
    description: 'Start building your personal knowledge lattice. Your thoughts, your way.',
    icon: Rocket
  }
];

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onAction?: (action: string) => void;
}

export function OnboardingWizard({ isOpen, onClose, onComplete, onAction }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    setCompletedSteps(prev => new Set([...prev, step.id]));

    if (isLastStep) {
      onComplete();
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [step.id, isLastStep, onComplete, onClose]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  const handleAction = () => {
    if (step.action && onAction) {
      onAction(step.action);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-lg mx-4 bg-lattice-bg border border-lattice-border rounded-2xl overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Progress dots */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    i === currentStep ? 'bg-neon-cyan' :
                    completedSteps.has(s.id) ? 'bg-green-500' : 'bg-gray-600'
                  )}
                />
              ))}
            </div>

            {/* Content */}
            <div className="p-8 pt-16">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-center"
                >
                  {/* Icon */}
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-neon-cyan/10 flex items-center justify-center">
                    <Icon className="w-10 h-10 text-neon-cyan" />
                  </div>

                  {/* Title */}
                  <h2 className="text-2xl font-bold text-white mb-3">
                    {step.title}
                  </h2>

                  {/* Description */}
                  <p className="text-gray-400 mb-8 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Action button (if applicable) */}
                  {step.action && (
                    <button
                      onClick={handleAction}
                      className="mb-6 px-4 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                    >
                      Try it now
                    </button>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="px-8 pb-8 flex items-center justify-between">
              <button
                onClick={handlePrev}
                disabled={isFirstStep}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  isFirstStep
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 bg-neon-cyan text-black font-medium rounded-lg hover:bg-neon-cyan/90 transition-colors"
              >
                {isLastStep ? (
                  <>
                    Get Started
                    <Check className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('concord-onboarding-completed');
    if (!completed) {
      setIsOpen(true);
    } else {
      setHasCompleted(true);
    }
  }, []);

  const complete = () => {
    localStorage.setItem('concord-onboarding-completed', 'true');
    setHasCompleted(true);
    setIsOpen(false);
  };

  const reset = () => {
    localStorage.removeItem('concord-onboarding-completed');
    setHasCompleted(false);
    setIsOpen(true);
  };

  return {
    isOpen,
    hasCompleted,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    complete,
    reset
  };
}
