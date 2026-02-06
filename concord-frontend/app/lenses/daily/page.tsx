'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState, useMemo } from 'react';
import { DailyNotes } from '@/components/daily/DailyNotes';
import {
  Calendar, Clock, Bell, FileText, Plus,
  Sparkles, CheckCircle2
} from 'lucide-react';

export default function DailyLensPage() {
  useLensNav('daily');

  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDue, setReminderDue] = useState('');
  const [showReminders, setShowReminders] = useState(false);

  const { data: dailyData } = useQuery({
    queryKey: ['daily-notes'],
    queryFn: () => apiHelpers.daily.list().then((r) => r.data),
  });

  const { data: currentData } = useQuery({
    queryKey: ['daily-current'],
    queryFn: () => apiHelpers.daily.get().then((r) => r.data),
  });

  const { data: dueReminders } = useQuery({
    queryKey: ['reminders-due'],
    queryFn: () => apiHelpers.daily.dueReminders().then((r) => r.data),
    refetchInterval: 60000,
  });

  const generateDigest = useMutation({
    mutationFn: () => apiHelpers.daily.digest(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily-notes'] }),
  });

  const createReminder = useMutation({
    mutationFn: () => apiHelpers.daily.createReminder({ title: reminderTitle, dueAt: reminderDue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders-due'] });
      setReminderTitle('');
      setReminderDue('');
    },
  });

  const completeReminder = useMutation({
    mutationFn: (id: string) => apiHelpers.daily.completeReminder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders-due'] }),
  });

  const notes = useMemo(() => {
    const raw = dailyData?.notes || dailyData || [];
    return Array.isArray(raw) ? raw : [];
  }, [dailyData]);

  const currentNote = useMemo(() => {
    return notes.find((n: any) => n.date === selectedDate) || currentData?.note || null;
  }, [notes, selectedDate, currentData]);

  const reminders = dueReminders?.reminders || dueReminders || [];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-lattice-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📓</span>
          <div>
            <h1 className="text-xl font-bold">Daily Lens</h1>
            <p className="text-sm text-gray-400">
              Daily notes, reminders, and knowledge digests
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReminders(!showReminders)}
            className="btn-neon flex items-center gap-1 text-sm relative"
          >
            <Bell className="w-3 h-3" /> Reminders
            {Array.isArray(reminders) && reminders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {reminders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => generateDigest.mutate()}
            disabled={generateDigest.isPending}
            className="btn-neon purple flex items-center gap-1 text-sm"
          >
            <Sparkles className="w-3 h-3" />
            {generateDigest.isPending ? 'Generating...' : 'Generate Digest'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main content: DailyNotes component */}
        <div className="flex-1">
          <DailyNotes
            notes={notes}
            currentNote={currentNote}
            onSelectDate={setSelectedDate}
            onEditNote={(dtuId) => window.open(`/lenses/thread?id=${dtuId}`, '_blank')}
            className="h-full"
          />
        </div>

        {/* Reminders Sidebar */}
        {showReminders && (
          <div className="w-80 border-l border-lattice-border bg-lattice-surface/50 p-4 overflow-y-auto">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-neon-yellow" /> Reminders
            </h2>

            {/* Create Reminder */}
            <div className="space-y-2 mb-4 pb-4 border-b border-lattice-border">
              <input
                type="text"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="Reminder title..."
                className="input-lattice w-full text-sm"
              />
              <input
                type="datetime-local"
                value={reminderDue}
                onChange={(e) => setReminderDue(e.target.value)}
                className="input-lattice w-full text-sm"
              />
              <button
                onClick={() => createReminder.mutate()}
                disabled={!reminderTitle || !reminderDue || createReminder.isPending}
                className="btn-neon purple w-full text-sm"
              >
                <Plus className="w-3 h-3 inline mr-1" /> Create
              </button>
            </div>

            {/* Due Reminders */}
            <div className="space-y-2">
              {Array.isArray(reminders) && reminders.length > 0 ? reminders.map((r: any) => (
                <div key={r.id} className="lens-card text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-gray-400">
                        {r.dueAt ? new Date(r.dueAt).toLocaleString() : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => completeReminder.mutate(r.id)}
                      className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-center py-4 text-gray-500 text-sm">No reminders due</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
