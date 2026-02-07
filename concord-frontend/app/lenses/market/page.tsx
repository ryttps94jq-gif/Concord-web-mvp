'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { MarketEmpireListing } from '@/components/market/MarketEmpireListing';
import { Store, TrendingUp, Package, Coins } from 'lucide-react';

export default function MarketLensPage() {
  useLensNav('market');

  // Backend: GET /api/marketplace/listings
  const { data: listings } = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: () => api.get('/api/marketplace/listings').then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏪</span>
          <div>
            <h1 className="text-xl font-bold">Market Lens</h1>
            <p className="text-sm text-gray-400">
              DTU marketplace, listings, and economy simulation
            </p>
          </div>
        </div>
        <button className="btn-neon purple">
          <Store className="w-4 h-4 mr-2 inline" />
          Create Listing
        </button>
      </header>

      {/* Market Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Store />} label="Active Listings" value={listings?.listings?.length || 0} />
        <StatCard icon={<Package />} label="Your Library" value="—" />
        <StatCard icon={<TrendingUp />} label="Transactions" value="—" />
        <StatCard icon={<Coins />} label="Volume" value="—" />
      </div>

      {/* Listings Grid */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-neon-green" />
          Active Listings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings?.listings?.length === 0 ? (
            <p className="col-span-full text-center py-8 text-gray-500">
              No listings yet. Create the first marketplace listing!
            </p>
          ) : (
            listings?.listings?.map((listing: Record<string, unknown>) => (
              <MarketEmpireListing key={listing.id} listing={listing} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="lens-card">
      <div className="flex items-center justify-between">
        <span className="text-neon-green">{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-sm text-gray-400 mt-2">{label}</p>
    </div>
  );
}
