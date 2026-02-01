'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, Repeat, Shuffle, Heart } from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  resonanceScore: number;
}

export default function MusicLensPage() {
  useLensNav('music');

  const queryClient = useQueryClient();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(75);

  const { data: currentTrack } = useQuery({
    queryKey: ['music-current'],
    queryFn: () => api.get('/api/music/current').then((r) => r.data),
  });

  const { data: queue } = useQuery({
    queryKey: ['music-queue'],
    queryFn: () => api.get('/api/music/queue').then((r) => r.data),
  });

  const { data: playlists } = useQuery({
    queryKey: ['music-playlists'],
    queryFn: () => api.get('/api/music/playlists').then((r) => r.data),
  });

  const togglePlay = useMutation({
    mutationFn: () => api.post('/api/music/toggle'),
    onSuccess: () => setIsPlaying(!isPlaying),
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎵</span>
          <div>
            <h1 className="text-xl font-bold">Music Lens</h1>
            <p className="text-sm text-gray-400">
              Resonance-based audio experience
            </p>
          </div>
        </div>
      </header>

      {/* Now Playing */}
      <div className="panel p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Album Art */}
          <div className="w-48 h-48 mx-auto md:mx-0 rounded-lg bg-gradient-to-br from-neon-purple/30 to-neon-blue/30 flex items-center justify-center">
            <Music className="w-16 h-16 text-neon-cyan" />
          </div>

          {/* Track Info & Controls */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {currentTrack?.title || 'No track playing'}
              </h2>
              <p className="text-gray-400">{currentTrack?.artist || 'Unknown artist'}</p>
              <p className="text-sm text-gray-500">{currentTrack?.album}</p>

              {/* Resonance Score */}
              {currentTrack && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Resonance</span>
                  <div className="flex-1 max-w-32 h-2 bg-lattice-deep rounded-full">
                    <div
                      className="h-full bg-gradient-to-r from-neon-blue to-neon-purple rounded-full"
                      style={{ width: `${(currentTrack.resonanceScore || 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono">
                    {((currentTrack.resonanceScore || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="h-1 bg-lattice-deep rounded-full">
                <div
                  className="h-full bg-neon-blue rounded-full transition-all"
                  style={{
                    width: `${
                      currentTrack?.duration
                        ? (currentTime / currentTrack.duration) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(currentTrack?.duration || 0)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4">
              <button className="text-gray-400 hover:text-white">
                <Shuffle className="w-5 h-5" />
              </button>
              <button className="text-gray-400 hover:text-white">
                <SkipBack className="w-6 h-6" />
              </button>
              <button
                onClick={() => togglePlay.mutate()}
                className="w-14 h-14 rounded-full bg-neon-blue flex items-center justify-center hover:bg-neon-blue/80 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </button>
              <button className="text-gray-400 hover:text-white">
                <SkipForward className="w-6 h-6" />
              </button>
              <button className="text-gray-400 hover:text-white">
                <Repeat className="w-5 h-5" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gray-400" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-8">{volume}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue */}
        <div className="panel p-4">
          <h3 className="font-semibold mb-4">Up Next</h3>
          <div className="space-y-2">
            {queue?.tracks?.length === 0 ? (
              <p className="text-center py-4 text-gray-500">Queue is empty</p>
            ) : (
              queue?.tracks?.slice(0, 5).map((track: Track, index: number) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-lattice-elevated cursor-pointer"
                >
                  <span className="text-gray-500 text-sm w-6">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{track.title}</p>
                    <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTime(track.duration)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Playlists */}
        <div className="panel p-4">
          <h3 className="font-semibold mb-4">Playlists</h3>
          <div className="space-y-2">
            {playlists?.playlists?.map((playlist: any) => (
              <div
                key={playlist.id}
                className="lens-card flex items-center gap-3 cursor-pointer"
              >
                <div className="w-12 h-12 rounded bg-gradient-to-br from-neon-purple/30 to-neon-pink/30 flex items-center justify-center">
                  <Music className="w-6 h-6 text-neon-purple" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{playlist.name}</p>
                  <p className="text-xs text-gray-400">
                    {playlist.trackCount} tracks
                  </p>
                </div>
                <Heart
                  className={`w-4 h-4 ${
                    playlist.liked ? 'text-neon-pink fill-neon-pink' : 'text-gray-400'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
