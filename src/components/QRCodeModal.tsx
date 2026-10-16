import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, QrCode } from 'lucide-react';
import { useHaptics } from '../hooks/useHaptics';

interface QRCodeModalProps {
  roomCode: string;
  roomName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  roomCode,
  roomName,
  isOpen,
  onClose,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const haptics = useHaptics();

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?join=${roomCode}`
    : `https://fairplay.app/?join=${roomCode}`;

  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1E1B4B',
        light: '#FFFFFF',
      },
    })
      .then(url => setQrUrl(url))
      .catch(err => console.error('QR code generation error:', err));
  }, [joinUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    haptics.lightTap();
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-black/5 flex flex-col items-center text-center">
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2 text-left">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Passenger Join Code</h3>
              <p className="text-xs text-slate-500">{roomName}</p>
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

        {/* QR Code Container (Apple SwiftUI style) */}
        <div className="p-3 bg-[#F2F2F7] rounded-2xl shadow-inner border border-slate-200/60 mb-4">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`QR Code to join room ${roomCode}`}
              className="w-56 h-56 rounded-xl bg-white p-2"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
              Generating QR Code...
            </div>
          )}
        </div>

        {/* Big Code Display */}
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Room Code</p>
          <div className="px-5 py-2 rounded-2xl bg-indigo-50 border border-indigo-100/80 inline-flex items-center gap-2">
            <span className="font-mono text-2xl font-extrabold tracking-widest text-indigo-600">
              {roomCode}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-5 max-w-xs leading-relaxed">
          Passengers can scan this code with their camera to join the queue. 
          <span className="font-semibold text-slate-700"> No Spotify account or app installation required.</span>
        </p>

        <button
          onClick={handleCopy}
          className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm shadow-indigo-200 cursor-pointer transition-all"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Join Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
