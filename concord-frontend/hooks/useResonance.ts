import { useQuery } from '@tanstack/react-query';
import { useLatticeStore } from '@/store/lattice';
import { api } from '@/lib/api/client';
import { useEffect } from 'react';
import { useResonanceSocket } from './useSocket';

interface ResonanceData {
  overall: number;
  coherence: number;
  stability: number;
  homeostasis: number;
  bioAge: number;
  continuity: number;
  dtuCounts: {
    regular: number;
    mega: number;
    hyper: number;
    shadow: number;
  };
  lastUpdated: string;
}

export function useResonance() {
  const setResonance = useLatticeStore((state) => state.setResonance);
  const resonance = useLatticeStore((state) => state.resonance);

  // Fetch initial data
  const { data, isLoading, error, refetch } = useQuery<ResonanceData>({
    queryKey: ['resonance'],
    queryFn: () => api.get('/api/lattice/resonance').then((r) => r.data),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Subscribe to real-time updates
  const { resonanceData, isConnected } = useResonanceSocket();

  // Update store when data changes
  useEffect(() => {
    if (data) {
      setResonance({
        overall: data.overall,
        coherence: data.coherence,
        stability: data.stability,
        homeostasis: data.homeostasis,
        bioAge: data.bioAge,
        continuity: data.continuity,
      });
    }
  }, [data, setResonance]);

  // Update from socket when available
  useEffect(() => {
    if (resonanceData) {
      const rd = resonanceData as ResonanceData;
      setResonance({
        overall: rd.overall,
        coherence: rd.coherence,
        stability: rd.stability,
        homeostasis: rd.homeostasis,
        bioAge: rd.bioAge,
        continuity: rd.continuity,
      });
    }
  }, [resonanceData, setResonance]);

  return {
    resonance,
    dtuCounts: data?.dtuCounts,
    isLoading,
    error,
    refetch,
    isRealtime: isConnected,
  };
}

export function useResonanceStatus() {
  const resonance = useLatticeStore((state) => state.resonance);

  const getStatus = (value: number): 'optimal' | 'good' | 'warning' | 'critical' => {
    if (value >= 0.8) return 'optimal';
    if (value >= 0.6) return 'good';
    if (value >= 0.4) return 'warning';
    return 'critical';
  };

  return {
    overall: {
      value: resonance.overall,
      status: getStatus(resonance.overall),
    },
    coherence: {
      value: resonance.coherence,
      status: getStatus(resonance.coherence),
    },
    stability: {
      value: resonance.stability,
      status: getStatus(resonance.stability),
    },
    homeostasis: {
      value: resonance.homeostasis,
      status: getStatus(resonance.homeostasis),
    },
    bioAge: {
      value: resonance.bioAge,
      status: getStatus(resonance.bioAge),
    },
    continuity: {
      value: resonance.continuity,
      status: getStatus(resonance.continuity),
    },
  };
}
