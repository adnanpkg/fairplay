import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useHaptics } from '../hooks/useHaptics';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const haptics = useHaptics();

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    haptics.mediumTap();
    await install();
  };

  const handleIOSClick = () => {
    haptics.lightTap();
    setShowIOSGuide(true);
  };

  return (
    <>
      {isInstallable && (
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-full shadow-sm shadow-indigo-200 transition-all cursor-pointer"
          aria-label="Install FairPlay PWA"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {isIOS && !isInstallable && (
        <button
          onClick={handleIOSClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-full border border-slate-200/60 transition-all cursor-pointer"
          aria-label="Install FairPlay on iOS"
        >
          <Download className="w-3.5 h-3.5 text-indigo-600" />
          <span>Install App</span>
        </button>
      )}

      {/* iOS Safari Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-black/5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                  FP
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">Install FairPlay</h3>
                  <p className="text-xs text-slate-500">Add to iPhone / iPad Home Screen</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 my-5 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-800 font-semibold text-xs mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    Tap the Share icon <Share2 className="w-4 h-4 text-indigo-600 inline" />
                  </p>
                  <p className="text-xs text-slate-500">Located at the bottom toolbar in Safari</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-800 font-semibold text-xs mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    Select &quot;Add to Home Screen&quot; <PlusSquare className="w-4 h-4 text-indigo-600 inline" />
                  </p>
                  <p className="text-xs text-slate-500">Scroll down the share sheet and tap Add</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
