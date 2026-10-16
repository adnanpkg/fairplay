import React, { useState } from 'react';
import { QrCode, Sliders, Copy, Check, LogOut, Radio } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { useHaptics } from '../hooks/useHaptics';

interface HeaderProps {
  roomCode: string;
  isHost: boolean;
  onOpenQR: () => void;
  onOpenSettings: () => void;
  onLeaveRoom: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  isHost,
  onOpenQR,
  onOpenSettings,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const haptics = useHaptics();

  const handleCopyCode = () => {
    haptics.lightTap();
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-black/5 transition-all">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* Brand Left */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                FairPlay
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-md">
                Aux
              </span>
            </div>
          </div>
        </div>

        {/* Room Code Badge (Center/Right) */}
        {roomCode && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyCode}
              title="Click to copy Room Code"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F2F2F7] hover:bg-slate-200/80 active:scale-95 transition border border-slate-200/60 cursor-pointer"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Code
              </span>
              <span className="font-mono text-xs font-black tracking-wider text-indigo-600">
                {roomCode}
              </span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>
        )}

        {/* Action Controls Right */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {roomCode && (
            <>
              {/* QR Code button */}
              <button
                onClick={() => {
                  haptics.lightTap();
                  onOpenQR();
                }}
                title="Passenger QR Code"
                className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
              </button>

              {/* Host Settings button */}
              {isHost && (
                <button
                  onClick={() => {
                    haptics.lightTap();
                    onOpenSettings();
                  }}
                  title="Host Room Settings"
                  className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Leave Room Button */}
          {roomCode && (
            <button
              onClick={() => {
                haptics.lightTap();
                onLeaveRoom();
              }}
              title="Leave Room"
              className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
