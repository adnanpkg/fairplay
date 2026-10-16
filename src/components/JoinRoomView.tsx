import React, { useState, useEffect } from 'react';
import {
  Car,
  Headphones,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Disc,
  Clock,
  Radio,
} from 'lucide-react';
import { useHaptics } from '../hooks/useHaptics';

interface JoinRoomViewProps {
  onCreateRoom: (hostNickname: string, sessionName: string, capSeconds: number) => Promise<void>;
  onJoinRoom: (code: string, nickname: string, avatar: string) => Promise<{ success: boolean; error?: string }>;
  initialCode?: string;
}

const AVATARS = ['🚗', '🎧', '⚡', '🎸', '🪩', '🌴', '🚀', '🏎️', '🎷', '🐻'];

export const JoinRoomView: React.FC<JoinRoomViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  initialCode = '',
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialCode ? 'join' : 'create');
  
  // Host state
  const [hostNickname, setHostNickname] = useState('Road Captain');
  const [sessionName, setSessionName] = useState('Weekend Road Trip');
  const [capSeconds, setCapSeconds] = useState(300);

  // Guest state
  const [roomCode, setRoomCode] = useState(initialCode.toUpperCase());
  const [guestNickname, setGuestNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🎧');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const haptics = useHaptics();

  useEffect(() => {
    if (initialCode) {
      setRoomCode(initialCode.toUpperCase());
      setActiveTab('join');
    }
  }, [initialCode]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostNickname.trim()) {
      setErrorMessage('Please enter a host nickname');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    haptics.mediumTap();
    try {
      await onCreateRoom(hostNickname.trim(), sessionName.trim(), capSeconds);
    } catch {
      setErrorMessage('Could not create room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage('Please enter the 4-to-6 digit room code');
      return;
    }
    if (!guestNickname.trim()) {
      setErrorMessage('Please enter a nickname for the aux queue');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    haptics.mediumTap();

    const result = await onJoinRoom(cleanCode, guestNickname.trim(), selectedAvatar);
    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to join room. Verify code.');
      haptics.errorNotice();
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto py-6 px-4 flex flex-col items-center">
      {/* Hero Badge & Title in Apple SwiftUI Style */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-bold mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Strict Round-Robin Music Queue</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Democratize the Aux
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          No aux hogs. No skipped songs by majority veto bullying. Every passenger gets their turn in strict sequence.
        </p>
      </div>

      {/* Apple-style Segmented Control */}
      <div className="w-full bg-[#F2F2F7] p-1 rounded-2xl flex items-center border border-slate-200/60 shadow-inner mb-6">
        <button
          type="button"
          onClick={() => {
            haptics.lightTap();
            setActiveTab('create');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'create'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Car className="w-4 h-4 text-indigo-600" />
          <span>Host a Trip (Admin)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptics.lightTap();
            setActiveTab('join');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'join'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Headphones className="w-4 h-4 text-indigo-600" />
          <span>Join with Code (Guest)</span>
        </button>
      </div>

      {/* Error message alert */}
      {errorMessage && (
        <div className="w-full p-3 mb-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 animate-fadeIn text-center">
          {errorMessage}
        </div>
      )}

      {/* Tab 1: Create Room (Host) */}
      {activeTab === 'create' && (
        <form
          onSubmit={handleCreateSubmit}
          className="w-full bg-white rounded-3xl p-6 border border-slate-200/60 shadow-lg shadow-slate-100/60 space-y-4"
        >
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Host / Driver Nickname
            </label>
            <input
              type="text"
              value={hostNickname}
              onChange={(e) => setHostNickname(e.target.value)}
              placeholder="e.g. Alex (Driver)"
              maxLength={24}
              required
              className="w-full px-4 py-3 bg-[#F2F2F7] rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 border border-transparent focus:border-indigo-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Trip / Session Name
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. West Coast Road Trip"
              maxLength={36}
              className="w-full px-4 py-3 bg-[#F2F2F7] rounded-2xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 border border-transparent focus:border-indigo-500/30"
            />
          </div>

          <div className="p-4 bg-[#F2F2F7] rounded-2xl border border-slate-200/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Default Track Cap</span>
              </span>
              <span className="font-mono text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                {Math.floor(capSeconds / 60)}:00 max
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Prevents long songs from dominating everyone else&apos;s turn.
            </p>
            <input
              type="range"
              min="180"
              max="600"
              step="30"
              value={capSeconds}
              onChange={(e) => setCapSeconds(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold shadow-md shadow-indigo-200 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Start Road Trip Aux</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Tab 2: Join Room (Guest) */}
      {activeTab === 'join' && (
        <form
          onSubmit={handleJoinSubmit}
          className="w-full bg-white rounded-3xl p-6 border border-slate-200/60 shadow-lg shadow-slate-100/60 space-y-4"
        >
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              4-to-6 Digit Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. ROAD42"
              maxLength={8}
              required
              className="w-full px-4 py-3 bg-[#F2F2F7] rounded-2xl text-center font-mono text-xl font-extrabold tracking-widest text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 uppercase border border-transparent focus:border-indigo-500/30"
            />
            <p className="text-[11px] text-slate-400 text-center mt-1">
              Ask the driver for the code or scan their QR
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Your Passenger Nickname
            </label>
            <input
              type="text"
              value={guestNickname}
              onChange={(e) => setGuestNickname(e.target.value)}
              placeholder="e.g. Jordan (Backseat DJ)"
              maxLength={24}
              required
              className="w-full px-4 py-3 bg-[#F2F2F7] rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 border border-transparent focus:border-indigo-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Choose Passenger Avatar
            </label>
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => {
                    haptics.lightTap();
                    setSelectedAvatar(av);
                  }}
                  className={`py-2 text-xl rounded-2xl transition cursor-pointer flex items-center justify-center ${
                    selectedAvatar === av
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105'
                      : 'bg-[#F2F2F7] hover:bg-slate-200/70 text-slate-700'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold shadow-md shadow-indigo-200 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Join Aux Queue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Feature Value Props in Apple SwiftUI Card */}
      <div className="w-full mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-[#F2F2F7] rounded-2xl border border-slate-200/50 text-left">
          <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
            <Radio className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Strict Round-Robin</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Turns alternate in a circle ($P_1 \to P_2 \dots$). Input is locked until your turn.
          </p>
        </div>

        <div className="p-4 bg-[#F2F2F7] rounded-2xl border border-slate-200/50 text-left">
          <div className="w-7 h-7 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 mb-2">
            <Clock className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Track Length Cap</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Admin limits songs to 5 mins so nobody drops a 20-minute prog rock opus.
          </p>
        </div>

        <div className="p-4 bg-[#F2F2F7] rounded-2xl border border-slate-200/50 text-left">
          <div className="w-7 h-7 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 mb-2">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Zero App or Login</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Guests join via browser QR. Only the host needs Spotify Premium if connecting.
          </p>
        </div>
      </div>
    </div>
  );
};
