'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Clock, CheckCircle2, Star, RotateCcw,
  Brain, TrendingUp
} from 'lucide-react';

interface SRSItem {
  dtuId: string;
  title?: string;
  content?: string;
  nextReview?: string;
  interval?: number;
  easiness?: number;
  repetitions?: number;
}

export default function SRSLensPage() {
  useLensNav('srs');

  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [addDtuId, setAddDtuId] = useState('');

  const { data: dueData, isLoading } = useQuery({
    queryKey: ['srs-due'],
    queryFn: () => apiHelpers.srs.due().then((r) => r.data),
    refetchInterval: 30000,
  });

  const addToSrs = useMutation({
    mutationFn: (dtuId: string) => apiHelpers.srs.add(dtuId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['srs-due'] });
      setAddDtuId('');
    },
  });

  const reviewItem = useMutation({
    mutationFn: ({ dtuId, quality }: { dtuId: string; quality: number }) =>
      apiHelpers.srs.review(dtuId, { quality }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['srs-due'] });
      setShowAnswer(false);
      setCurrentIndex((prev) => prev + 1);
    },
  });

  const dueItems: SRSItem[] = dueData?.items || dueData?.due || dueData || [];
  const current = dueItems[currentIndex];
  const remaining = Math.max(0, dueItems.length - currentIndex);

  const qualityButtons = [
    { label: 'Blackout', quality: 0, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { label: 'Wrong', quality: 1, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { label: 'Hard', quality: 3, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { label: 'Good', quality: 4, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { label: 'Easy', quality: 5, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <div>
            <h1 className="text-xl font-bold">Spaced Repetition</h1>
            <p className="text-sm text-gray-400">
              Review DTUs on optimal schedule for long-term retention
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={addDtuId}
            onChange={(e) => setAddDtuId(e.target.value)}
            placeholder="DTU ID to add..."
            className="input-lattice w-40 text-sm"
          />
          <button
            onClick={() => addToSrs.mutate(addDtuId)}
            disabled={!addDtuId || addToSrs.isPending}
            className="btn-neon text-sm"
          >
            Add to SRS
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Clock className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">{remaining}</p>
          <p className="text-sm text-gray-400">Due Now</p>
        </div>
        <div className="lens-card">
          <BookOpen className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{dueItems.length}</p>
          <p className="text-sm text-gray-400">Total Items</p>
        </div>
        <div className="lens-card">
          <CheckCircle2 className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{currentIndex}</p>
          <p className="text-sm text-gray-400">Reviewed</p>
        </div>
        <div className="lens-card">
          <TrendingUp className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">—</p>
          <p className="text-sm text-gray-400">Retention</p>
        </div>
      </div>

      {/* Review Card */}
      <div className="max-w-2xl mx-auto">
        {isLoading ? (
          <div className="panel p-12 text-center text-gray-500">Loading review items...</div>
        ) : !current ? (
          <div className="panel p-12 text-center text-gray-500">
            <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">All caught up!</p>
            <p className="text-sm mt-2">No more items due for review. Add DTUs to your SRS queue.</p>
          </div>
        ) : (
          <motion.div className="panel p-6 space-y-4" layout>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {currentIndex + 1} / {dueItems.length}
              </span>
              {current.repetitions != null && (
                <span className="text-xs text-gray-400">
                  Reps: {current.repetitions}
                </span>
              )}
            </div>

            {/* Question */}
            <div className="p-4 bg-lattice-surface rounded-lg min-h-[120px] flex items-center justify-center">
              <p className="text-center">{current.title || current.content || current.dtuId}</p>
            </div>

            {/* Answer */}
            <AnimatePresence>
              {showAnswer ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg min-h-[80px]">
                    <p className="text-sm">{current.content || 'Review this DTU to reinforce understanding.'}</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mt-4">
                    {qualityButtons.map((btn) => (
                      <button
                        key={btn.quality}
                        onClick={() => reviewItem.mutate({ dtuId: current.dtuId, quality: btn.quality })}
                        disabled={reviewItem.isPending}
                        className={`p-2 rounded-lg border text-sm font-medium ${btn.color}`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="btn-neon purple w-full text-center"
                >
                  Show Answer
                </button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
