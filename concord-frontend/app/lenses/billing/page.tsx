'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  Coins, Check, Zap, Crown,
  ArrowRight, Sparkles, ShieldCheck, TrendingUp
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface TokenPackage {
  id: string;
  tokens: number;
  price: number;
  bonus: number;
}

export default function BillingPage() {
  const _queryClient = useQueryClient();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  // Get economic config
  const { data: config, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['economic-config'],
    queryFn: () => api.get('/api/economic/config').then(r => r.data),
  });

  // Get wallet
  const { data: wallet, isLoading: walletLoading, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['wallet'],
    queryFn: () => {
      const odId = localStorage.getItem('concord_od_id') || 'default';
      return api.get(`/api/economic/wallet/${odId}`).then(r => r.data);
    },
  });

  // Purchase tokens
  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const odId = localStorage.getItem('concord_od_id') || 'default';
      const res = await api.post('/api/economic/tokens/purchase', { odId, packageId });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  // Subscribe
  const subscribeMutation = useMutation({
    mutationFn: async (tier: string) => {
      const odId = localStorage.getItem('concord_od_id') || 'default';
      const res = await api.post('/api/economic/subscribe', { odId, tier });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const _tiers = config?.tiers || {};
  const tokenPackages = config?.tokenPackages || [];


  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Billing & Tokens</h1>
        <p className="text-gray-400">Manage your subscription and Concord Tokens</p>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-lattice-surface border border-lattice-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-neon-cyan/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-neon-cyan" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Token Balance</p>
              <p className="text-2xl font-bold text-white">
                {walletLoading ? '...' : (wallet?.balance || 0).toLocaleString()} CT
              </p>
            </div>
          </div>
        </div>

        <div className="bg-lattice-surface border border-lattice-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-neon-purple/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Current Tier</p>
              <p className="text-2xl font-bold text-white capitalize">
                {walletLoading ? '...' : (wallet?.tier || 'free')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-lattice-surface border border-lattice-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-neon-green/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-neon-green" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Daily Ingest</p>
              <p className="text-2xl font-bold text-white">
                {walletLoading ? '...' : (
                  wallet?.ingestStatus?.limit === -1
                    ? 'Unlimited'
                    : `${wallet?.ingestStatus?.remaining || 0}/${wallet?.ingestStatus?.limit || 10}`
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Tiers */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Subscription Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Tier */}
          <TierCard
            name="Free"
            price={0}
            features={[
              'All 62 lenses',
              'Unlimited DTUs',
              'Marketplace access',
              '10 pages/day ingest',
              '100 tokens/month',
            ]}
            current={wallet?.tier === 'free'}
            onSelect={() => {}}
            disabled={true}
          />

          {/* Pro Tier */}
          <TierCard
            name="Pro"
            price={12}
            features={[
              'Everything in Free',
              'Unlimited ingest',
              'Cloud sync',
              'Priority support',
              '2,000 tokens/month',
            ]}
            current={wallet?.tier === 'pro'}
            popular={true}
            onSelect={() => subscribeMutation.mutate('pro')}
            loading={subscribeMutation.isPending}
            disabled={!config?.stripeEnabled}
          />

          {/* Teams Tier */}
          <TierCard
            name="Teams"
            price={29}
            priceNote="/seat"
            features={[
              'Everything in Pro',
              'Team collaboration',
              'Shared vaults',
              'Analytics dashboard',
              '5,000 tokens/month',
            ]}
            current={wallet?.tier === 'teams'}
            onSelect={() => subscribeMutation.mutate('teams')}
            loading={subscribeMutation.isPending}
            disabled={!config?.stripeEnabled}
          />
        </div>
      </div>

      {/* Token Packages */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Buy Tokens</h2>
        <p className="text-gray-400 text-sm mb-4">
          Concord Tokens (CT) are used for marketplace purchases and premium features.
          <span className="text-neon-cyan"> 1.46% fee</span> supports platform development.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tokenPackages.map((pkg: TokenPackage) => (
            <div
              key={pkg.id}
              className={`relative bg-lattice-surface border rounded-xl p-6 cursor-pointer transition-all ${
                selectedPackage === pkg.id
                  ? 'border-neon-cyan shadow-lg shadow-neon-cyan/20'
                  : 'border-lattice-border hover:border-gray-600'
              }`}
              onClick={() => setSelectedPackage(pkg.id)}
            >
              {pkg.bonus > 0 && (
                <div className="absolute -top-2 -right-2 px-2 py-1 bg-neon-green text-white text-xs font-bold rounded-full">
                  +{Math.round(pkg.bonus * 100)}%
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <Coins className="w-8 h-8 text-neon-cyan" />
                <div>
                  <p className="text-2xl font-bold text-white">{pkg.tokens.toLocaleString()}</p>
                  <p className="text-sm text-gray-400">tokens</p>
                </div>
              </div>

              <p className="text-3xl font-bold text-white mb-4">
                ${(pkg.price / 100).toFixed(2)}
              </p>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  purchaseMutation.mutate(pkg.id);
                }}
                disabled={purchaseMutation.isPending || !config?.stripeEnabled}
                className="w-full py-2 bg-neon-cyan/20 border border-neon-cyan/50 rounded-lg text-neon-cyan font-medium hover:bg-neon-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purchaseMutation.isPending ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>

        {!config?.stripeEnabled && (
          <p className="text-yellow-500 text-sm mt-4">
            Payment system is not configured. Contact support to enable purchases.
          </p>
        )}
      </div>

      {/* Economic Info */}
      <div className="bg-lattice-surface border border-lattice-border rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-neon-green" />
          How the Economy Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-white mb-2">Marketplace Fees</h3>
            <ul className="space-y-1 text-gray-400">
              <li>* 4% marketplace fee on sales</li>
              <li>* 70% goes to the creator</li>
              <li>* 20% goes to referenced DTUs (royalties)</li>
              <li>* 10% goes to Concord treasury</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">Royalty Wheel</h3>
            <ul className="space-y-1 text-gray-400">
              <li>* Gen 1 references: 30% of royalty pool</li>
              <li>* Gen 2 references: 20%</li>
              <li>* Gen 3 references: 10%</li>
              <li>* Deeper generations: 1-5%</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 p-4 bg-sovereignty-locked/10 border border-sovereignty-locked/30 rounded-lg">
          <div className="flex items-center gap-2 text-sovereignty-locked font-medium mb-1">
            <ShieldCheck className="w-4 h-4" />
            Self-Hosted = Always Free
          </div>
          <p className="text-sm text-gray-400">
            Running Concord on your own infrastructure is and always will be 100% free.
            All features, no limits, full sovereignty.
          </p>
        </div>
      </div>
    </div>
  );
}

function TierCard({
  name,
  price,
  priceNote,
  features,
  current,
  popular,
  onSelect,
  loading,
  disabled,
}: {
  name: string;
  price: number;
  priceNote?: string;
  features: string[];
  current?: boolean;
  popular?: boolean;
  onSelect: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={`relative bg-lattice-surface border rounded-xl p-6 ${
        popular ? 'border-neon-purple shadow-lg shadow-neon-purple/20' : 'border-lattice-border'
      } ${current ? 'ring-2 ring-neon-green' : ''}`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-neon-purple text-white text-xs font-bold rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Popular
        </div>
      )}

      {current && (
        <div className="absolute -top-3 right-4 px-3 py-1 bg-neon-green text-white text-xs font-bold rounded-full">
          Current
        </div>
      )}

      <h3 className="text-xl font-bold text-white mb-2">{name}</h3>

      <div className="mb-4">
        <span className="text-4xl font-bold text-white">${price}</span>
        <span className="text-gray-400">/mo{priceNote}</span>
      </div>

      <ul className="space-y-2 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
            <Check className="w-4 h-4 text-neon-green flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={current || loading || disabled}
        className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
          current
            ? 'bg-neon-green/20 text-neon-green cursor-default'
            : popular
            ? 'bg-neon-purple text-white hover:bg-neon-purple/80'
            : 'bg-lattice-elevated text-white hover:bg-lattice-border'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {current ? (
          <>
            <Check className="w-4 h-4" />
            Current Plan
          </>
        ) : loading ? (
          'Processing...'
        ) : (
          <>
            {price === 0 ? 'Get Started' : 'Upgrade'}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}
