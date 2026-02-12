'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { Loading } from '@/components/common/Loading';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, X, Users, Scale } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface ProposalData {
  title: string;
  description: string;
  proposer: string;
  type: 'upgrade' | 'policy' | 'resource' | 'entity';
  status: 'active' | 'passed' | 'rejected' | 'pending';
  votesFor: number;
  votesAgainst: number;
  threshold: number;
  deadline: string;
  createdAt: string;
}

const SEED_PROPOSALS: {
  title: string;
  data: Record<string, unknown>;
}[] = [];

export default function VoteLensPage() {
  useLensNav('vote');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'passed' | 'rejected'>('all');

  const { items: proposalItems, isLoading, isError, error, refetch } = useLensData<ProposalData>('vote', 'proposal', {
    seed: SEED_PROPOSALS,
  });

  // Map lens items to the proposal shape used in rendering
  const proposals = proposalItems.map((item) => ({
    id: item.id,
    title: item.title || item.data?.title || '',
    description: item.data?.description || '',
    proposer: item.data?.proposer || '',
    type: (item.data?.type || 'upgrade') as ProposalData['type'],
    status: (item.data?.status || 'pending') as ProposalData['status'],
    votesFor: item.data?.votesFor ?? 0,
    votesAgainst: item.data?.votesAgainst ?? 0,
    threshold: item.data?.threshold ?? 10,
    deadline: item.data?.deadline || '',
    createdAt: item.data?.createdAt || item.createdAt,
  }));

  const castVote = useMutation({
    mutationFn: async ({ proposalId, vote }: { proposalId: string; vote: 'for' | 'against' }) => {
      const { data } = await apiHelpers.council.vote({
        dtuId: proposalId,
        vote: vote === 'for' ? 'approve' : 'reject',
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lens', 'vote', 'list'] });
    },
  });

  const filteredProposals = proposals.filter((p) =>
    filter === 'all' ? true : p.status === filter
  );

  const typeColors = {
    upgrade: 'text-neon-cyan bg-neon-cyan/20',
    policy: 'text-neon-purple bg-neon-purple/20',
    resource: 'text-neon-green bg-neon-green/20',
    entity: 'text-neon-blue bg-neon-blue/20',
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loading text="Loading proposals..." />
      </div>
    );
  }


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🗳️</span>
          <div>
            <h1 className="text-xl font-bold">Vote Lens</h1>
            <p className="text-sm text-gray-400">
              Council voting on proposals and upgrades
            </p>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Scale className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{proposals.filter((p) => p.status === 'active').length}</p>
          <p className="text-sm text-gray-400">Active Votes</p>
        </div>
        <div className="lens-card">
          <Check className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{proposals.filter((p) => p.status === 'passed').length}</p>
          <p className="text-sm text-gray-400">Passed</p>
        </div>
        <div className="lens-card">
          <X className="w-5 h-5 text-neon-pink mb-2" />
          <p className="text-2xl font-bold">{proposals.filter((p) => p.status === 'rejected').length}</p>
          <p className="text-sm text-gray-400">Rejected</p>
        </div>
        <div className="lens-card">
          <Users className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">4</p>
          <p className="text-sm text-gray-400">Council Members</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'passed', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg capitalize ${
              filter === f
                ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                : 'bg-lattice-surface text-gray-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Proposals */}
      <div className="space-y-4">
        {filteredProposals.map((proposal) => {
          const progress = ((proposal.votesFor + proposal.votesAgainst) / proposal.threshold) * 100;
          const _approval = proposal.votesFor / (proposal.votesFor + proposal.votesAgainst || 1) * 100;

          return (
            <div key={proposal.id} className="panel p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{proposal.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${typeColors[proposal.type]}`}>
                      {proposal.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{proposal.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Proposed by {proposal.proposer} • Deadline: {proposal.deadline}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-sm ${
                    proposal.status === 'active'
                      ? 'bg-neon-blue/20 text-neon-blue'
                      : proposal.status === 'passed'
                      ? 'bg-neon-green/20 text-neon-green'
                      : proposal.status === 'rejected'
                      ? 'bg-neon-pink/20 text-neon-pink'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {proposal.status}
                </span>
              </div>

              {/* Vote Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neon-green">For: {proposal.votesFor}</span>
                  <span className="text-gray-400">{progress.toFixed(0)}% of quorum</span>
                  <span className="text-neon-pink">Against: {proposal.votesAgainst}</span>
                </div>
                <div className="h-3 bg-lattice-deep rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-neon-green"
                    style={{ width: `${(proposal.votesFor / proposal.threshold) * 100}%` }}
                  />
                  <div
                    className="h-full bg-neon-pink"
                    style={{ width: `${(proposal.votesAgainst / proposal.threshold) * 100}%` }}
                  />
                </div>
              </div>

              {/* Vote Buttons */}
              {proposal.status === 'active' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => castVote.mutate({ proposalId: proposal.id, vote: 'for' })}
                    disabled={castVote.isPending}
                    className="btn-neon green flex-1"
                  >
                    <Check className="w-4 h-4 mr-2 inline" />
                    {castVote.isPending ? 'Voting...' : 'Vote For'}
                  </button>
                  <button
                    onClick={() => castVote.mutate({ proposalId: proposal.id, vote: 'against' })}
                    disabled={castVote.isPending}
                    className="btn-neon pink flex-1"
                  >
                    <X className="w-4 h-4 mr-2 inline" />
                    {castVote.isPending ? 'Voting...' : 'Vote Against'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
