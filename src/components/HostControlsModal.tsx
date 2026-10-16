import React, { useState } from 'react';
import {
  X,
  Sliders,
  Clock,
  Vote,
  Radio,
  UserPlus,
  Check,
  Music,
  ExternalLink,
  Unlink,
  Copy,
} from 'lucide-react';
import { Room } from '../types/fairplay';
import { useHaptics } from '../hooks/useHaptics';
import { API_BASE } from '../config/api';

interface HostControlsModalProps {
  room: Room;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSettings: (settings: { maxDurationCapSeconds: number; vetoBudget: number; name: string }) => Promise<void>;
  onSimulatePassenger: () => Promise<void>;
  onDisconnectSpotify?: () => Promise<void>;
}

export const HostControlsModal: React.FC<HostControlsModalProps> = ({
  room,
  isOpen,
  onClose,
  onUpdateSettings,
  onSimulatePassenger,
  onDisconnectSpotify,
}) => {
  const [capSeconds, setCapSeconds] = useState<number>(room.maxDurationCapSeconds || 300);
  const [vetoBudget, setVetoBudget] = useState<number>(room.vetoBudget || 2);
  const [sessionName, setSessionName] = useState<string>(room.name || 'Road Trip');
  const [isSaving, setIsSaving] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const haptics = useHaptics();

  if (!isOpen) return null;

  const capMinutes = Math.floor(capSeconds / 60);
  const capSecs = capSeconds % 60;
  const formattedCap = `${capMinutes}:${capSecs.toString().padStart(2, '0')}`;

  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/spotify/callback`
    : '/api/spotify/callback';

  const handleSave = async () => {
    setIsSaving(true);
    haptics.mediumTap();
    await onUpdateSettings({
      maxDurationCapSeconds: capSeconds,
      vetoBudget,
      name: sessionName,
    });
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleAddPassenger = async () => {
    setIsSimulating(true);
    haptics.lightTap();
    await onSimulatePassenger();
    setIsSimulating(false);
  };

  const handleSpotifyConnect = () => {
    haptics.mediumTap();
    window.location.href = `${API_BASE}/api/spotify/login?roomCode=${encodeURIComponent(room.code)}`;
  };

  const handleCopyRedirect = () => {
    haptics.lightTap();
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 shadow-2xl border border-black/5 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Room Settings (Host)</h3>
              <p className="text-xs text-slate-500">Configure FairPlay Aux Rules</p>
            </div>
          </div>
          <button
            onClick={() => {
              haptics.lightTap();
              onClose();
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 text-sm">
          {/* Spotify Premium Integration Section */}
          <div className="p-4 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent rounded-2xl border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                  <Music className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Spotify Playback Sync</h4>
                  <p className="text-[11px] text-slate-500">Host Audio &amp; Real-Time Queue Push</p>
                </div>
              </div>

              {room.spotifyConfig?.connected ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Not Linked
                </span>
              )}
            </div>

            {room.spotifyConfig?.connected ? (
              <div className="mt-2 text-xs text-slate-600 space-y-2">
                <p className="font-medium text-slate-800">
                  Signed in as <span className="font-bold text-emerald-600">{room.spotifyConfig.userDisplayName}</span>
                  {room.spotifyConfig.product && ` (${room.spotifyConfig.product})`}
                </p>
                <p className="text-[11px] text-slate-500">
                  Whenever any passenger queues a track during their turn, FairPlay automatically sends it to your Spotify queue.
                </p>
                {onDisconnectSpotify && (
                  <button
                    onClick={async () => {
                      haptics.lightTap();
                      await onDisconnectSpotify();
                    }}
                    className="mt-1 text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Disconnect Spotify</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-600 space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Connect your Spotify Premium account so passenger track selections stream directly into your Spotify car queue.
                </p>
                <button
                  onClick={handleSpotifyConnect}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-200 transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Connect Spotify Host Account</span>
                </button>

                <div className="pt-2 border-t border-emerald-500/10">
                  <p className="text-[10px] text-slate-400 mb-1">
                    Spotify Developer App Redirect URI:
                  </p>
                  <div className="flex items-center gap-1.5 bg-white/80 p-1.5 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-600 truncate">
                    <span className="truncate flex-1">{redirectUri}</span>
                    <button
                      onClick={handleCopyRedirect}
                      className="p-1 hover:text-indigo-600 shrink-0"
                      title="Copy Redirect URI"
                    >
                      {copiedRedirect ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Session Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Session / Trip Name
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F2F2F7] rounded-xl text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="e.g. Pacific Coast Highway Cruise"
            />
          </div>

          {/* Track Duration Cap Slider (Anti-Abuse Rule) */}
          <div className="p-4 bg-[#F2F2F7] rounded-2xl border border-slate-200/60">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Track Duration Cap</span>
              </div>
              <span className="font-mono font-bold text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                {formattedCap} max
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Prevents passengers from queueing 15-minute tracks that hog the aux cord.
            </p>
            <input
              type="range"
              min="180"
              max="600"
              step="30"
              value={capSeconds}
              onChange={(e) => {
                setCapSeconds(parseInt(e.target.value, 10));
                haptics.lightTap();
              }}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>3:00 min</span>
              <span>5:00 min (standard)</span>
              <span>10:00 min</span>
            </div>
          </div>

          {/* Veto Budget per Passenger */}
          <div className="p-4 bg-[#F2F2F7] rounded-2xl border border-slate-200/60">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                <Vote className="w-4 h-4 text-rose-600" />
                <span>Veto Budget per Passenger</span>
              </div>
              <span className="font-bold text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                {vetoBudget} {vetoBudget === 1 ? 'vote' : 'votes'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Budget limits how many democratic skips each passenger can trigger during the trip.
            </p>
            <div className="flex gap-2">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setVetoBudget(num);
                    haptics.lightTap();
                  }}
                  className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                    vetoBudget === num
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {num} {num === 1 ? 'Skip' : 'Skips'}
                </button>
              ))}
            </div>
          </div>

          {/* Test Companion Injector */}
          <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-xs">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>Simulate Passenger</span>
              </div>
              <p className="text-[11px] text-indigo-700 mt-0.5">
                Add road-trip buddies to test the round-robin queue without needing multiple devices.
              </p>
            </div>
            <button
              onClick={handleAddPassenger}
              disabled={isSimulating}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0 cursor-pointer"
            >
              {isSimulating ? 'Adding...' : '+ Add Passenger'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm shadow-indigo-200 active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Saved!</span>
              </>
            ) : isSaving ? (
              <span>Saving...</span>
            ) : (
              <span>Save Rules</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
