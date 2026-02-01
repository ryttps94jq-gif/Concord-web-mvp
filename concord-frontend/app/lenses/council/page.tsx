'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Scale, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function CouncilLensPage() {
  useLensNav('council');
  const queryClient = useQueryClient();

  const { data: queues } = useQuery({
    queryKey: ['queues'],
    queryFn: () => api.get('/api/queues').then((r) => r.data),
  });

  const { data: proposals } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api.get('/api/proposals').then((r) => r.data),
  });

  const decideMutation = useMutation({
    mutationFn: async ({ queue, id, decision }: { queue: string; id: string; decision: string }) => {
      const res = await api.post(`/api/queues/${queue}/decide`, { id, decision });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });

  const pendingProposals = proposals?.proposals?.filter((p: any) => p.status === 'proposed') || [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">⚖️</span>
        <div>
          <h1 className="text-xl font-bold">Council Lens</h1>
          <p className="text-sm text-gray-400">
            Governance, proposals, and council decisions
          </p>
        </div>
      </header>

      {/* Queue Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QueueStat
          label="Pending Proposals"
          count={pendingProposals.length}
          icon={<Clock className="w-5 h-5" />}
        />
        <QueueStat
          label="Maintenance"
          count={queues?.queues?.maintenance?.length || 0}
          icon={<Scale className="w-5 h-5" />}
        />
        <QueueStat
          label="Synthesis"
          count={queues?.queues?.synthesis?.length || 0}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <QueueStat
          label="Notifications"
          count={queues?.queues?.notifications?.length || 0}
          icon={<XCircle className="w-5 h-5" />}
        />
      </div>

      {/* Active Proposals */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4 text-neon-purple" />
          Active Proposals
        </h2>
        <div className="space-y-3">
          {pendingProposals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No pending proposals. The council is at rest.
            </p>
          ) : (
            pendingProposals.slice(0, 10).map((proposal: any) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onDecide={(decision) =>
                  decideMutation.mutate({ queue: 'proposals', id: proposal.id, decision })
                }
              />
            ))
          )}
        </div>
      </div>

      {/* Recent Decisions */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4">Recent Decisions</h2>
        <div className="space-y-2">
          {proposals?.proposals
            ?.filter((p: any) => p.status !== 'proposed')
            .slice(0, 5)
            .map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg"
              >
                <span className="text-sm truncate flex-1">{p.action}</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    p.status === 'installed'
                      ? 'bg-sovereignty-locked/20 text-sovereignty-locked'
                      : 'bg-sovereignty-danger/20 text-sovereignty-danger'
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function QueueStat({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="lens-card">
      <div className="flex items-center justify-between">
        <span className="text-gray-400">{icon}</span>
        <span className="text-2xl font-bold text-neon-purple">{count}</span>
      </div>
      <p className="text-sm text-gray-400 mt-2">{label}</p>
    </div>
  );
}

function ProposalCard({
  proposal,
  onDecide,
}: {
  proposal: any;
  onDecide: (decision: string) => void;
}) {
  return (
    <div className="p-4 bg-lattice-deep rounded-lg border border-lattice-border">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium">{proposal.action}</p>
          <p className="text-sm text-gray-400 mt-1">
            {new Date(proposal.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onDecide('approve')}
            className="p-2 bg-sovereignty-locked/20 text-sovereignty-locked rounded-lg hover:bg-sovereignty-locked/30"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDecide('decline')}
            className="p-2 bg-sovereignty-danger/20 text-sovereignty-danger rounded-lg hover:bg-sovereignty-danger/30"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
