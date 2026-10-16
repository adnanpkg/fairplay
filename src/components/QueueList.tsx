import React from 'react';
import { ListMusic, Trash2, Clock, Sparkles } from 'lucide-react';
import { Track } from '../types/fairplay';
import { useHaptics } from '../hooks/useHaptics';

interface QueueListProps {
  queue: Track[];
  isHost: boolean;
  onRemoveTrack: (trackId: string) => void;
  onOpenSearch: () => void;
  isMyTurn: boolean;
  activePlayerNickname: string;
}

export const QueueList: React.FC<QueueListProps> = ({
  queue,
  isHost,
  onRemoveTrack,
  onOpenSearch,
  isMyTurn,
  activePlayerNickname,
}) => {
  const haptics = useHaptics();

  const formatMs = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/60 shadow-sm transition-all">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
            <ListMusic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">Upcoming Aux Queue</h3>
            <p className="text-xs text-slate-500">
              {queue.length} {queue.length === 1 ? 'song' : 'songs'} lined up
            </p>
          </div>
        </div>

        {isMyTurn && (
          <button
            onClick={() => {
              haptics.mediumTap();
              onOpenSearch();
            }}
            className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 active:scale-95 rounded-full transition cursor-pointer"
          >
            + Add Track
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F2F2F7] flex items-center justify-center text-2xl mb-3 shadow-inner">
            🎶
          </div>
          <h4 className="text-sm font-bold text-slate-800">The Queue is Empty!</h4>
          <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
            {isMyTurn
              ? 'You have the aux cord right now. Pick a song to keep the road trip going!'
              : `Waiting for ${activePlayerNickname} to add their round-robin pick.`}
          </p>

          {isMyTurn && (
            <button
              onClick={() => {
                haptics.mediumTap();
                onOpenSearch();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-2xl shadow-sm shadow-indigo-200 transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Choose Your Song</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {queue.map((track, index) => (
            <div
              key={track.id}
              className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 rounded-2xl px-2 transition group"
            >
              {/* Order number */}
              <span className="w-5 text-center font-mono text-xs font-bold text-slate-400">
                #{index + 1}
              </span>

              {/* Album cover */}
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 shrink-0 shadow-xs">
                <img
                  src={track.albumArt}
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Title, Artist & Queued By */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {track.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="truncate max-w-[120px]">{track.artist}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    {formatMs(track.durationMs)}
                  </span>
                </div>
              </div>

              {/* Queued by badge */}
              <div className="shrink-0 flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F2F2F7] rounded-full text-xs font-medium text-slate-700 border border-slate-200/50">
                  <span className="text-xs">{track.addedBy.avatar}</span>
                  <span className="text-[11px] font-semibold truncate max-w-[80px]">
                    {track.addedBy.nickname}
                  </span>
                </div>

                {/* Host remove action */}
                {isHost && (
                  <button
                    onClick={() => {
                      haptics.lightTap();
                      onRemoveTrack(track.id);
                    }}
                    title="Remove from queue (Host)"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
