import React from 'react';
import { Sparkles, Lock, ArrowRight, SkipForward, Music } from 'lucide-react';
import { Player } from '../types/fairplay';
import { useHaptics } from '../hooks/useHaptics';

interface TurnQueueBarProps {
  turnOrder: string[];
  players: Record<string, Player>;
  currentTurnPlayerId: string;
  myPlayerId: string;
  onOpenSearch: () => void;
  onPassTurn: () => void;
}

export const TurnQueueBar: React.FC<TurnQueueBarProps> = ({
  turnOrder,
  players,
  currentTurnPlayerId,
  myPlayerId,
  onOpenSearch,
  onPassTurn,
}) => {
  const haptics = useHaptics();
  const isMyTurn = currentTurnPlayerId === myPlayerId;
  const activePlayer = players[currentTurnPlayerId];

  // Calculate turns away for current user
  const activeOrder = turnOrder.filter(id => players[id]);
  const currentIndex = activeOrder.indexOf(currentTurnPlayerId);
  const myIndex = activeOrder.indexOf(myPlayerId);
  
  let turnsAway = 0;
  if (myIndex !== -1 && currentIndex !== -1) {
    turnsAway = (myIndex - currentIndex + activeOrder.length) % activeOrder.length;
  }

  // Next player up
  const nextPlayerIndex = (currentIndex + 1) % (activeOrder.length || 1);
  const nextPlayer = players[activeOrder[nextPlayerIndex]];

  return (
    <div className="w-full bg-[#F2F2F7] rounded-3xl p-4 sm:p-5 border border-slate-200/60 shadow-sm transition-all">
      {/* Top Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
          <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-500">
            Aux Turn Order
          </h2>
        </div>

        <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
          <span>Strict Round-Robin</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
          <span>{activeOrder.length} Passengers</span>
        </div>
      </div>

      {/* Circular Passengers Scroll / Carousel */}
      <div className="flex items-center gap-3 overflow-x-auto py-2 px-1 scrollbar-none">
        {activeOrder.map((pid, idx) => {
          const p = players[pid];
          if (!p) return null;
          const isActive = pid === currentTurnPlayerId;
          const isMe = pid === myPlayerId;
          const isUpNext = pid === nextPlayer?.id && !isActive;

          return (
            <div
              key={pid}
              className={`flex flex-col items-center shrink-0 transition-all ${
                isActive ? 'scale-105' : 'opacity-85'
              }`}
            >
              <div className="relative">
                {/* Ring Indicator */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all shadow-sm ${
                    isActive
                      ? 'ring-3 ring-indigo-500 ring-offset-2 ring-offset-white bg-white shadow-indigo-200 shadow-md'
                      : 'bg-white border border-slate-200/80'
                  }`}
                  style={{
                    boxShadow: isActive ? '0 8px 20px -4px rgba(99, 102, 241, 0.35)' : undefined,
                  }}
                >
                  <span>{p.avatar}</span>
                </div>

                {/* Badge Overlay */}
                {isActive && (
                  <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white rounded-full p-1 shadow-sm">
                    <Sparkles className="w-2.5 h-2.5" />
                  </span>
                )}
                {isUpNext && (
                  <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[9px] font-bold px-1 rounded-full shadow-xs">
                    Next
                  </span>
                )}
              </div>

              <div className="mt-1.5 text-center">
                <p className={`text-xs font-bold truncate max-w-[72px] ${isActive ? 'text-indigo-600' : 'text-slate-700'}`}>
                  {p.nickname}
                </p>
                <p className="text-[10px] text-slate-400">
                  {isMe ? '(You)' : p.role === 'host' ? 'Host' : `P${idx + 1}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Interactive Action Box based on Turn State */}
      <div className="mt-4 pt-3.5 border-t border-slate-200/80">
        {isMyTurn ? (
          <div className="p-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl text-white shadow-md shadow-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-left w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <Music className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full">
                    Your Turn Active
                  </span>
                </div>
                <p className="text-sm font-bold text-white mt-0.5">
                  You have the Aux Cord! Pick the next vibe.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => {
                  haptics.mediumTap();
                  onOpenSearch();
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-white text-indigo-700 text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Add Song</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  haptics.lightTap();
                  onPassTurn();
                }}
                title="Pass aux turn to next passenger"
                className="px-2.5 py-2 bg-indigo-700/60 hover:bg-indigo-700 active:scale-95 text-white/90 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Aux Locked &bull; Currently{' '}
                  <span className="font-bold text-indigo-600">
                    {activePlayer?.nickname || 'Someone'}
                  </span>
                  &apos;s turn
                </p>
                <p className="text-[11px] text-slate-500">
                  {turnsAway === 1 ? (
                    <span className="text-amber-600 font-semibold">You&apos;re up next! Get your song ready.</span>
                  ) : (
                    `You are ${turnsAway} turns away in round-robin order.`
                  )}
                </p>
              </div>
            </div>

            {/* Locked disabled button to respect input locking requirement */}
            <button
              disabled
              className="px-3 py-1.5 bg-slate-100 text-slate-400 text-xs font-medium rounded-xl cursor-not-allowed flex items-center gap-1 opacity-70"
            >
              <Lock className="w-3 h-3" />
              <span>Locked</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
