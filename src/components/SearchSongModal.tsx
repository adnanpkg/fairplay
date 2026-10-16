import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Play,
  Pause,
  Plus,
  AlertTriangle,
  Clock,
  Sparkles,
  Check,
  Disc3,
} from 'lucide-react';
import { Track, SearchTrackResult } from '../types/fairplay';
import { useHaptics } from '../hooks/useHaptics';

interface SearchSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQueueTrack: (track: SearchTrackResult) => Promise<{ success: boolean; error?: string }>;
  maxDurationCapSeconds: number;
  isMyTurn: boolean;
  activePlayerNickname: string;
}

const PRESET_VIBES = [
  'Daft Punk Get Lucky',
  'Fleetwood Mac Dreams',
  'The Weeknd Blinding Lights',
  'Dua Lipa Levitating',
  'Queen Bohemian Rhapsody',
  'Empire of the Sun Walking On A Dream',
  'Gorillaz Feel Good Inc',
  'Arctic Monkeys Do I Wanna Know',
];

export const SearchSongModal: React.FC<SearchSongModalProps> = ({
  isOpen,
  onClose,
  onQueueTrack,
  maxDurationCapSeconds,
  isMyTurn,
  activePlayerNickname,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchTrackResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittingTrackId, setSubmittingTrackId] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const searchTimeoutRef = useRef<any>(null);
  const haptics = useHaptics();

  const maxCapMinutes = Math.floor(maxDurationCapSeconds / 60);
  const maxCapSeconds = maxDurationCapSeconds % 60;
  const formattedCap = `${maxCapMinutes}:${maxCapSeconds.toString().padStart(2, '0')}`;

  // Initial popular search on open
  useEffect(() => {
    if (isOpen && results.length === 0 && !query) {
      searchSongs('Road trip top hits');
    }
  }, [isOpen]);

  const searchSongs = async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setErrorMsg('Failed to search music catalog. Check network.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchSongs(val);
    }, 350);
  };

  const handlePreviewToggle = (track: SearchTrackResult) => {
    haptics.lightTap();
    if (previewTrackId === track.id) {
      previewAudioRef.current?.pause();
      setPreviewTrackId(null);
    } else {
      if (track.previewUrl) {
        if (!previewAudioRef.current) {
          previewAudioRef.current = new Audio();
        }
        previewAudioRef.current.src = track.previewUrl;
        previewAudioRef.current.play().catch(() => {});
        previewAudioRef.current.onended = () => setPreviewTrackId(null);
        setPreviewTrackId(track.id);
      }
    }
  };

  const handleSelectTrack = async (track: SearchTrackResult) => {
    if (!isMyTurn) {
      haptics.errorNotice();
      setErrorMsg(`Input locked! It is currently ${activePlayerNickname}'s turn.`);
      return;
    }

    // Check Track Length Cap
    const maxMs = maxDurationCapSeconds * 1000;
    if (track.durationMs > maxMs) {
      haptics.errorNotice();
      setErrorMsg(
        `Track exceeds the maximum room limit of ${formattedCap}. Please choose a shorter track to keep the aux fair!`
      );
      return;
    }

    setSubmittingTrackId(track.id);
    haptics.songAdded();

    // Stop preview if running
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPreviewTrackId(null);
    }

    const res = await onQueueTrack(track);
    setSubmittingTrackId(null);

    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || 'Failed to queue track.');
      haptics.errorNotice();
    }
  };

  const formatMs = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl max-h-[92vh] sm:max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-black/5 flex flex-col overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-indigo-50 text-indigo-600">
              <Disc3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Pick Aux Track</h2>
              <p className="text-xs text-slate-500">
                Max duration cap:{' '}
                <span className="font-semibold text-indigo-600">{formattedCap}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (previewAudioRef.current) previewAudioRef.current.pause();
              haptics.lightTap();
              onClose();
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Lock Banner if not user's turn */}
        {!isMyTurn && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs font-semibold text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              It is currently {activePlayerNickname}&apos;s turn. You can browse songs now, but queueing is locked until your turn!
            </span>
          </div>
        )}

        {/* Error Notification Toast */}
        {errorMsg && (
          <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between gap-2 text-xs font-bold text-rose-700 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search Input in Apple SwiftUI style */}
        <div className="p-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Search song, artist, album..."
              className="w-full pl-10 pr-10 py-3 bg-[#F2F2F7] rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all border border-transparent focus:border-indigo-500/30"
              autoFocus
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Vibe Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" /> Quick:
            </span>
            {PRESET_VIBES.map((vibe) => (
              <button
                key={vibe}
                onClick={() => {
                  haptics.lightTap();
                  setQuery(vibe);
                  searchSongs(vibe);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-medium shrink-0 transition cursor-pointer"
              >
                {vibe.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 divide-y divide-slate-100">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Searching catalog...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <p className="text-sm font-medium">No songs found</p>
              <p className="text-xs mt-1">Try another track or artist name</p>
            </div>
          ) : (
            results.map((track) => {
              const exceedsCap = track.durationMs > maxDurationCapSeconds * 1000;
              const isPreviewing = previewTrackId === track.id;
              const isSubmitting = submittingTrackId === track.id;

              return (
                <div
                  key={track.id}
                  className={`py-3 flex items-center justify-between gap-3 group transition ${
                    exceedsCap ? 'opacity-60 bg-rose-50/20' : 'hover:bg-slate-50/80'
                  } rounded-2xl px-2`}
                >
                  {/* Left: Album cover with 30s preview button */}
                  <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shadow-xs">
                    <img
                      src={track.albumArt}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                    {track.previewUrl && (
                      <button
                        onClick={() => handlePreviewToggle(track)}
                        title={isPreviewing ? 'Pause preview' : 'Play 30s preview'}
                        className={`absolute inset-0 flex items-center justify-center transition backdrop-blur-xs cursor-pointer ${
                          isPreviewing
                            ? 'bg-indigo-600/80 text-white'
                            : 'bg-black/30 opacity-0 group-hover:opacity-100 text-white'
                        }`}
                      >
                        {isPreviewing ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Middle: Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {track.title}
                    </h4>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {track.artist}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                        <Clock className="w-3 h-3" />
                        {formatMs(track.durationMs)}
                      </span>

                      {exceedsCap && (
                        <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Exceeds {formattedCap}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Add button with validation feedback */}
                  <div className="shrink-0">
                    {exceedsCap ? (
                      <button
                        disabled
                        title={`Track length (${formatMs(track.durationMs)}) exceeds the ${formattedCap} road-trip cap.`}
                        className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-500 text-xs font-semibold rounded-xl cursor-not-allowed opacity-80"
                      >
                        Over Cap
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSelectTrack(track)}
                        disabled={isSubmitting}
                        className={`px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                          isMyTurn
                            ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-100'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 cursor-pointer'
                        }`}
                        title={isMyTurn ? 'Add to Aux queue' : 'Locked until your turn'}
                      >
                        {isSubmitting ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Queue</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
