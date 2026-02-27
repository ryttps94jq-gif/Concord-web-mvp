'use client';

/**
 * PersonalAgentPanel — Shows proactive insights from the user's personal AI agent.
 * Meeting preps, overdue alerts, workout adjustments, meal reminders.
 */

import { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';

interface AgentInsight {
  type: 'meeting_prep' | 'overdue_alert' | 'workout_adjustment' | 'meal_reminder';
  suggestion: string;
  event?: { title: string; hoursUntil: number };
  items?: { name: string }[];
}

interface PersonalAgentPanelProps {
  socket?: { on: (event: string, handler: (data: unknown) => void) => void };
  onAction?: (insight: AgentInsight) => void;
}

export function PersonalAgentPanel({ socket, onAction }: PersonalAgentPanelProps) {
  const [insights, setInsights] = useState<AgentInsight[]>([]);

  useEffect(() => {
    if (!socket) return;
    socket.on('agent:insights', (data: { insights: AgentInsight[] }) => {
      setInsights(data.insights);
    });
  }, [socket]);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
        <Bot className="w-4 h-4 text-purple-400" />
        Your Agent
      </h3>
      {insights.map((insight, i) => (
        <div
          key={i}
          className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700
            hover:border-purple-500/30 transition-colors"
        >
          <p className="text-sm text-zinc-200">{insight.suggestion}</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onAction?.(insight)}
              className="text-xs px-2 py-1 rounded bg-purple-500/10
                text-purple-400 border border-purple-500/30
                hover:bg-purple-500/20 transition-colors"
            >
              Do it
            </button>
            <button className="text-xs px-2 py-1 rounded bg-zinc-800
              text-zinc-500 border border-zinc-700
              hover:bg-zinc-700 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
