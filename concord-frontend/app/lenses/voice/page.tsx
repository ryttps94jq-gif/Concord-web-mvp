'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import { VoiceRecorder } from '@/components/voice/VoiceRecorder';
import { Mic, FileText, CheckCircle2 } from 'lucide-react';

export default function VoiceLensPage() {
  useLensNav('voice');

  const queryClient = useQueryClient();
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const handleTranscribe = async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    const res = await apiHelpers.voice.transcribe(formData);
    return res.data?.transcript || res.data?.text || '';
  };

  const handleSave = async (audioBlob: Blob, transcript?: string) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    if (transcript) formData.append('transcript', transcript);

    try {
      await apiHelpers.voice.ingest(formData);
      setLastTranscript(transcript || null);
      setSavedCount((c) => c + 1);
      queryClient.invalidateQueries({ queryKey: ['dtus'] });
    } catch (err) {
      console.error('Failed to save voice note:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🎙️</span>
        <div>
          <h1 className="text-xl font-bold">Voice Lens</h1>
          <p className="text-sm text-gray-400">
            Voice recording — transcribe and ingest audio into the knowledge lattice
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="lens-card">
          <Mic className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{savedCount}</p>
          <p className="text-sm text-gray-400">Saved This Session</p>
        </div>
        <div className="lens-card">
          <FileText className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{lastTranscript ? 'Yes' : '—'}</p>
          <p className="text-sm text-gray-400">Last Transcription</p>
        </div>
        <div className="lens-card">
          <CheckCircle2 className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">Ready</p>
          <p className="text-sm text-gray-400">Status</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto">
        <VoiceRecorder
          onTranscribe={handleTranscribe}
          onSave={handleSave}
          maxDuration={300}
        />
      </div>

      {lastTranscript && (
        <div className="max-w-xl mx-auto panel p-4">
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-neon-cyan" /> Last Transcript
          </h2>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{lastTranscript}</p>
        </div>
      )}
    </div>
  );
}
