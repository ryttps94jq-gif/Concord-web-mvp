'use client';

/**
 * PurchaseButton — Handles marketplace artifact purchases with royalty cascade.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ShoppingCart, Loader } from 'lucide-react';

interface PurchaseButtonProps {
  artifactId: string;
  price: number;
  currency?: string;
}

export function PurchaseButton({ artifactId, price, currency = 'tokens' }: PurchaseButtonProps) {
  const queryClient = useQueryClient();
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);

  const purchase = async () => {
    setPurchasing(true);
    try {
      const result = await api.post('/api/marketplace/purchaseWithRoyalties', {
        dtuId: artifactId,
      });

      if (result.data.ok) {
        setPurchased(true);
        queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
    } catch (err) {
      console.error('Purchase failed:', err);
    } finally {
      setPurchasing(false);
    }
  };

  if (purchased) {
    return (
      <span className="flex items-center gap-2 px-4 py-2 rounded-lg
        bg-neon-green/10 border border-neon-green/30 text-neon-green text-sm">
        {'\u2713'} Purchased
      </span>
    );
  }

  return (
    <button
      onClick={purchase}
      disabled={purchasing}
      className="flex items-center gap-2 px-4 py-2 rounded-lg
        bg-neon-green/10 border border-neon-green/30 text-neon-green
        hover:bg-neon-green/20 transition-all text-sm
        disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {purchasing ? <Loader className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
      {price > 0 ? `${price} ${currency}` : 'Free'}
    </button>
  );
}

export default PurchaseButton;
