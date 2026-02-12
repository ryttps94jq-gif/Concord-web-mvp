'use client';

import React, { useState } from 'react';
import {
  Activity, Brain, FlaskConical, Layers, Radio,
  BarChart3, Zap, Shield
} from 'lucide-react';
import PipelineMonitor from '@/components/platform/PipelineMonitor';
import NerveCenter from '@/components/platform/NerveCenter';
import EmpiricalGatesPanel from '@/components/platform/EmpiricalGatesPanel';
import ScopeControls from '@/components/platform/ScopeControls';
import { usePlatformEvents } from '@/components/platform/usePlatformEvents';

type Tab = 'overview' | 'pipeline' | 'nerve' | 'empirical' | 'scope' | 'events';

const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3, desc: 'System-wide dashboard' },
  { id: 'pipeline', label: 'Pipeline', icon: Activity, desc: 'Autogen pipeline monitor' },
  { id: 'nerve', label: 'Nerve Center', icon: Brain, desc: 'Beacon, strategy, hypothesis' },
  { id: 'empirical', label: 'Empirical', icon: FlaskConical, desc: 'Math, units, constants' },
  { id: 'scope', label: 'Scopes', icon: Layers, desc: 'Global/Local/Marketplace' },
  { id: 'events', label: 'Live Events', icon: Radio, desc: 'Real-time event stream' },
];

function EventStreamPanel({ events, connected }: { events: Array<{ type: string; data: Record<string, unknown>; timestamp: string }>; connected: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-3">
          <Radio className="w-6 h-6 text-neon-pink" />
          Live Event Stream
        </h2>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
          connected ? 'bg-neon-green/10 border border-neon-green/20' : 'bg-gray-600/10 border border-gray-600/20'
        }`}>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-neon-green animate-pulse' : 'bg-gray-500'}`} />
          <span className={`text-xs ${connected ? 'text-neon-green' : 'text-gray-500'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Radio className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Waiting for events...</p>
          <p className="text-xs mt-1">Events will appear here in real-time as the system operates.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {events.map((event, i) => {
            const colors: Record<string, string> = {
              'dtu:created': 'text-neon-green',
              'dtu:updated': 'text-neon-blue',
              'dtu:deleted': 'text-neon-orange',
              'pipeline:completed': 'text-neon-purple',
              'beacon:check': 'text-neon-cyan',
              'heartbeat:tick': 'text-gray-400',
            };
            return (
              <div key={`${event.timestamp}-${i}`} className="flex items-center gap-3 px-4 py-2 bg-lattice-elevated rounded-lg border border-lattice-border">
                <Zap className={`w-3 h-3 ${colors[event.type] || 'text-gray-400'} shrink-0`} />
                <span className={`text-xs font-mono ${colors[event.type] || 'text-gray-400'}`}>
                  {event.type}
                </span>
                <span className="text-xs text-gray-500 flex-1 truncate">
                  {JSON.stringify(event.data).slice(0, 120)}
                </span>
                <span className="text-[10px] text-gray-600 shrink-0">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OverviewDashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-100 flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-neon-cyan" />
        Platform Overview
      </h2>

      {/* Quick status cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <PipelineMonitor />
        </div>
        <div className="space-y-6">
          <NerveCenter />
        </div>
      </div>
    </div>
  );
}

export default function PlatformPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { events, connected } = usePlatformEvents();

  return (
    <div className="min-h-screen bg-lattice-void text-gray-200">
      {/* Top Bar */}
      <div className="border-b border-lattice-border bg-lattice-deep/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Shield className="w-7 h-7 text-neon-blue" />
              <div>
                <h1 className="text-lg font-bold text-gray-100">Concord Platform</h1>
                <p className="text-xs text-gray-500">v5.5.0 — Pipeline + Empirical Gates + Capability Bridge</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              connected ? 'bg-neon-green/10' : 'bg-gray-600/10'
            }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-neon-green animate-pulse' : 'bg-gray-500'}`} />
              <span className={`text-xs ${connected ? 'text-neon-green' : 'text-gray-500'}`}>
                {connected ? 'Live' : 'Polling'}
              </span>
              {events.length > 0 && (
                <span className="text-[10px] text-gray-500 ml-1">({events.length} events)</span>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-neon-blue text-neon-blue bg-lattice-surface'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-lattice-surface/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && <OverviewDashboard />}
        {activeTab === 'pipeline' && <PipelineMonitor />}
        {activeTab === 'nerve' && <NerveCenter />}
        {activeTab === 'empirical' && <EmpiricalGatesPanel />}
        {activeTab === 'scope' && <ScopeControls />}
        {activeTab === 'events' && <EventStreamPanel events={events} connected={connected} />}
      </div>
    </div>
  );
}
