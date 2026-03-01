'use client';

/**
 * useChatProactive — Proactive message system for the Chat Rail.
 *
 * Generates contextual suggestions based on:
 *   - Time-of-day triggers (morning summary, end-of-day review)
 *   - Lens navigation patterns (suggest related lenses)
 *   - Idle detection (after 30s inactivity, offer suggestions)
 *   - DTU events (new/promoted DTUs)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ProactiveMessage, ProactiveTrigger } from './ChatModeTypes';

const IDLE_TIMEOUT_MS = 30_000; // 30 seconds

interface UseChatProactiveOptions {
  currentLens: string;
  messageCount: number;
  enabled: boolean;
}

function generateId(): string {
  return `proactive-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Working late? Here are some suggestions';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Working late? Here are some suggestions';
}

function getTimeSuggestion(): ProactiveMessage | null {
  const hour = new Date().getHours();
  const now = new Date().toISOString();

  if (hour >= 7 && hour <= 9) {
    return {
      id: generateId(),
      trigger: 'time_based',
      content: `${getTimeOfDayGreeting()}! Would you like a morning briefing of your substrate activity?`,
      actionLabel: 'Morning Brief',
      actionPayload: 'Give me a morning summary of what happened in my substrate overnight',
      dismissed: false,
      timestamp: now,
    };
  }
  if (hour >= 17 && hour <= 19) {
    return {
      id: generateId(),
      trigger: 'time_based',
      content: 'End of day approaching. Want a recap of today\'s activity and insights?',
      actionLabel: 'Daily Recap',
      actionPayload: 'Give me an end-of-day recap of today\'s activity, key DTUs, and insights',
      dismissed: false,
      timestamp: now,
    };
  }
  return null;
}

function getLensNavigationSuggestion(currentLens: string): ProactiveMessage | null {
  const now = new Date().toISOString();

  const lensRelations: Record<string, { related: string; reason: string }[]> = {
    healthcare: [
      { related: 'fitness', reason: 'Your health data connects to fitness metrics' },
      { related: 'nutrition', reason: 'Nutrition insights complement your health profile' },
    ],
    fitness: [
      { related: 'healthcare', reason: 'Your fitness progress can inform health decisions' },
      { related: 'nutrition', reason: 'Nutrition and fitness go hand-in-hand' },
    ],
    finance: [
      { related: 'legal', reason: 'Financial planning often has legal implications' },
      { related: 'insurance', reason: 'Financial security connects to insurance coverage' },
    ],
    education: [
      { related: 'career', reason: 'Your learning connects to career development' },
    ],
    creative: [
      { related: 'music', reason: 'Creative work often spans across artistic domains' },
    ],
  };

  const relations = lensRelations[currentLens];
  if (!relations || relations.length === 0) return null;

  const suggestion = relations[Math.floor(Math.random() * relations.length)];
  return {
    id: generateId(),
    trigger: 'lens_navigation',
    content: `You're in ${currentLens}. ${suggestion.reason}. Want to explore the ${suggestion.related} lens?`,
    actionLabel: `Open ${suggestion.related}`,
    actionPayload: `navigate:${suggestion.related}`,
    dismissed: false,
    timestamp: now,
  };
}

function getIdleSuggestions(currentLens: string): ProactiveMessage {
  const suggestions = [
    {
      content: 'Need inspiration? I can show you trending topics in your substrate.',
      actionLabel: 'Show Trends',
      actionPayload: 'Show me trending topics and recent activity across my substrate',
    },
    {
      content: 'I noticed some cross-domain connections you might find interesting.',
      actionLabel: 'Show Connections',
      actionPayload: 'Show me interesting cross-domain connections in my knowledge base',
    },
    {
      content: `Want me to summarize your recent ${currentLens} activity?`,
      actionLabel: 'Summarize',
      actionPayload: `Summarize my recent activity in the ${currentLens} lens`,
    },
    {
      content: 'Your substrate has grown recently. Want a knowledge health check?',
      actionLabel: 'Health Check',
      actionPayload: 'Run a knowledge health check on my substrate and report gaps or opportunities',
    },
  ];

  const pick = suggestions[Math.floor(Math.random() * suggestions.length)];
  return {
    id: generateId(),
    trigger: 'idle',
    content: pick.content,
    actionLabel: pick.actionLabel,
    actionPayload: pick.actionPayload,
    dismissed: false,
    timestamp: new Date().toISOString(),
  };
}

export function useChatProactive({
  currentLens,
  messageCount,
  enabled,
}: UseChatProactiveOptions) {
  const [proactiveMessages, setProactiveMessages] = useState<ProactiveMessage[]>([]);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const hasShownTimeSuggestion = useRef(false);
  const lastLensForSuggestion = useRef(currentLens);

  // Reset idle timer on activity
  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
  }, []);

  // Dismiss a proactive message
  const dismissProactive = useCallback((id: string) => {
    setProactiveMessages(prev =>
      prev.map(m => m.id === id ? { ...m, dismissed: true } : m)
    );
  }, []);

  // Dismiss all proactive messages
  const dismissAll = useCallback(() => {
    setProactiveMessages(prev => prev.map(m => ({ ...m, dismissed: true })));
  }, []);

  // Add a DTU event notification
  const addDTUNotification = useCallback((dtuTitle: string, action: 'created' | 'promoted') => {
    const msg: ProactiveMessage = {
      id: generateId(),
      trigger: 'dtu_event',
      content: action === 'created'
        ? `New DTU created: "${dtuTitle}". Want to explore it?`
        : `DTU promoted: "${dtuTitle}". It's now available globally.`,
      actionLabel: 'View DTU',
      actionPayload: `Show me details about the DTU "${dtuTitle}"`,
      dismissed: false,
      timestamp: new Date().toISOString(),
    };
    setProactiveMessages(prev => [...prev.slice(-4), msg]); // Keep max 5
  }, []);

  // Time-based suggestion — once per session
  useEffect(() => {
    if (!enabled || hasShownTimeSuggestion.current) return;
    const timeSuggestion = getTimeSuggestion();
    if (timeSuggestion) {
      hasShownTimeSuggestion.current = true;
      // Delay so it doesn't appear instantly
      const timer = setTimeout(() => {
        setProactiveMessages(prev => [...prev, timeSuggestion]);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [enabled]);

  // Lens navigation suggestion — when lens changes
  useEffect(() => {
    if (!enabled) return;
    if (currentLens === lastLensForSuggestion.current) return;
    lastLensForSuggestion.current = currentLens;

    // Wait a moment before suggesting related lenses
    const timer = setTimeout(() => {
      const suggestion = getLensNavigationSuggestion(currentLens);
      if (suggestion) {
        setProactiveMessages(prev => {
          // Don't stack too many navigation suggestions
          const nonNavOnes = prev.filter(m => m.trigger !== 'lens_navigation' || m.dismissed);
          return [...nonNavOnes, suggestion];
        });
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentLens, enabled]);

  // Idle detection — suggest after 30s of inactivity
  useEffect(() => {
    if (!enabled || messageCount === 0) return;

    const checkIdle = () => {
      idleTimerRef.current = setTimeout(() => {
        const activeMessages = proactiveMessages.filter(m => !m.dismissed);
        if (activeMessages.length < 2) {
          const idleSuggestion = getIdleSuggestions(currentLens);
          setProactiveMessages(prev => [...prev.slice(-4), idleSuggestion]);
        }
      }, IDLE_TIMEOUT_MS);
    };

    checkIdle();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [enabled, messageCount, currentLens, proactiveMessages.length]);

  // Reset idle timer when messageCount changes (user activity)
  useEffect(() => {
    resetIdleTimer();
  }, [messageCount, resetIdleTimer]);

  const activeProactiveMessages = proactiveMessages.filter(m => !m.dismissed);

  return {
    proactiveMessages: activeProactiveMessages,
    dismissProactive,
    dismissAll,
    addDTUNotification,
    resetIdleTimer,
  };
}
