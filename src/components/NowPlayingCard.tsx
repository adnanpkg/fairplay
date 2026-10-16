import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Vote,
  Sparkles,
  Music2,
  CheckCircle2,
} from 'lucide-react';
import { Track, PlaybackState, Player } from '../types/fairplay';
import { useHaptics } from '../hooks/useHaptics';

interface NowPlayingCardProps {
  playback: PlaybackState;
  players: Record<string, Player>;
  myPlayerId: string;
  isHost: boolean;
  spotifyConnected?: boolean;
  onPlaybackAction: (action: 'play' | 'pause' | 'next' | 'previous' | 'seek', positionMs?: number) => void;
  onCastVeto: () => void;
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({
  playback,
  players,
  myPlayerId,
  isHost,
  spotifyConnected,
  onPlaybackAction,
  onCastVeto,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [localProgress, setLocalProgress] = useState<number>(playback.positionMs || 0);
  const haptics = useHaptics();

  const currentTrack: Track | null = playback.currentTrack;
  const isPlaying = playback.isPlaying;
  const myPlayer = players[myPlayerId];
  const hasVotedVeto = currentTrack?.vetoVoterIds.includes(myPlayerId);
  const vetosLeft = myPlayer?.vetosRemaining ?? 0;

  // Active passengers & required democratic skip threshold
  const totalPassengers = Object.keys(players).length;
  const requiredVotes = totalPassengers <= 2 ? 1 : Math.ceil(totalPassengers * 0.5);
  const currentVotes = currentTrack?.vetoVoterIds.length || 0;

  // Audio stream binding
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack?.previewUrl) {
      if (audio.src !== currentTrack.previewUrl) {
        audio.src = currentTrack.previewUrl;
        audio.currentTime = 0;
      }

      if (isPlaying) {
        audio.play().catch(() => {
          // Auto-play was prevented by browser policy until user interacts
        });
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
    }
  }, [currentTrack?.previewUrl, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle song ending in host player: trigger next track automatically
  const handleAudioEnded = () => {
    if (isHost) {
      onPlaybackAction('next');
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const ms = Math.floor(audioRef.current.currentTime * 1000);
      setLocalProgress(ms);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const trackDuration = currentTrack ? (audioRef.current?.duration ? Math.floor(audioRef.current.duration * 1000) : currentTrack.durationMs) : 0;
  const progressPercent = trackDuration > 0 ? Math.min(100, (localProgress / trackDuration) * 100) : 0;

  const handleVetoClick = () => {
    if (hasVotedVeto || vetosLeft <= 0) return;
    haptics.vetoVoted();
    onCastVeto();
  };

  return (
    <div className="w-full bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/60 shadow-lg shadow-slate-100/80 transition-all">
      {/* Hidden audio element for authentic audio playback */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onTimeUpdate={handleTimeUpdate}
      />

      <div className="flex flex-col md:flex-row gap-6 items-center">
        {/* Album Cover Art / Spinning Vinyl in Apple SwiftUI style */}
        <div className="relative shrink-0 group">
          <div
            className={`w-40 h-40 sm:w-48 sm:h-48 rounded-3xl overflow-hidden bg-slate-900 shadow-xl transition-all duration-700 ${
              isPlaying ? 'shadow-indigo-500/25 rotate-0' : 'shadow-slate-300'
            }`}
          >
            {currentTrack?.albumArt ? (
              <img
                src={currentTrack.albumArt}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100">
                <Music2 className="w-12 h-12 stroke-[1.5] text-slate-300 mb-2" />
                <span className="text-xs font-medium">Queue is Idle</span>
              </div>
            )}
          </div>

          {/* Playing wave pulse badge */}
          {isPlaying && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-full flex items-center gap-1.5 text-white text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span>LIVE AUX</span>
            </div>
          )}
        </div>

        {/* Track Details & Controls */}
        <div className="flex-1 w-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Now Playing on Aux
                </span>

                {spotifyConnected && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Spotify Synced
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentTrack?.externalUrl && (
                  <a
                    href={currentTrack.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <span>Spotify</span>
                    <span className="text-[9px]">↗</span>
                  </a>
                )}

                {currentTrack?.addedBy && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/50">
                    <span className="text-xs">{currentTrack.addedBy.avatar}</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[110px]">
                      {currentTrack.addedBy.nickname}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight line-clamp-1">
              {currentTrack?.title || 'No Track Selected'}
            </h3>
            <p className="text-sm font-medium text-slate-500 line-clamp-1 mt-0.5">
              {currentTrack?.artist || 'Add a song to start the road trip!'}
            </p>
          </div>

          {/* Progress Bar / Scrubber */}
          <div className="mt-4">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative cursor-pointer">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono font-medium text-slate-400 mt-1.5">
              <span>{formatTime(localProgress)}</span>
              <span>{currentTrack ? formatTime(trackDuration) : '0:00'}</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {/* Playback Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  haptics.lightTap();
                  onPlaybackAction('previous');
                }}
                disabled={!isHost}
                title={isHost ? 'Previous Track' : 'Host controls playback'}
                className="p-2.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={() => {
                  haptics.mediumTap();
                  onPlaybackAction(isPlaying ? 'pause' : 'play');
                }}
                disabled={!currentTrack || !isHost}
                title={isHost ? (isPlaying ? 'Pause' : 'Play') : 'Host controls playback'}
                className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={() => {
                  haptics.lightTap();
                  onPlaybackAction('next');
                }}
                disabled={!isHost}
                title={isHost ? 'Skip to Next Track' : 'Host controls playback'}
                className="p-2.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              {/* Volume Slider for Host */}
              {isHost && (
                <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-1.5 text-slate-400 hover:text-slate-600"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if (isMuted) setIsMuted(false);
                    }}
                    className="w-16 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Democratic Veto / Skip Budget Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleVetoClick}
                disabled={!currentTrack || hasVotedVeto || vetosLeft <= 0}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                  hasVotedVeto
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 cursor-default'
                    : vetosLeft <= 0
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200/70 shadow-rose-100 cursor-pointer'
                }`}
                title={
                  hasVotedVeto
                    ? 'You have voted to skip this song'
                    : `Democratic Veto: ${currentVotes}/${requiredVotes} votes to skip. (${vetosLeft} veto tokens left)`
                }
              >
                {hasVotedVeto ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Veto Cast ({currentVotes}/{requiredVotes})</span>
                  </>
                ) : (
                  <>
                    <Vote className="w-4 h-4 text-rose-600" />
                    <span>Veto Song</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-200/70 text-[10px] font-black">
                      {vetosLeft} left
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
