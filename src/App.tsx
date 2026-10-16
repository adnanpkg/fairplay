/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { TurnQueueBar } from './components/TurnQueueBar';
import { NowPlayingCard } from './components/NowPlayingCard';
import { QueueList } from './components/QueueList';
import { SearchSongModal } from './components/SearchSongModal';
import { QRCodeModal } from './components/QRCodeModal';
import { HostControlsModal } from './components/HostControlsModal';
import { JoinRoomView } from './components/JoinRoomView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Room, SearchTrackResult } from './types/fairplay';
import { useHaptics } from './hooks/useHaptics';

const STORAGE_KEY = 'fairplay_session_v1';

export default function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const lastTurnPlayerIdRef = useRef<string>('');
  const haptics = useHaptics();

  // 1. Initial Load: Read stored session or URL join query
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join') || params.get('code');
    const spotifyStatus = params.get('spotify');

    if (spotifyStatus === 'connected') {
      showToast('Spotify Host Account connected! Queue push is active.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.code && parsed.playerId) {
          // If URL param specifies a different code, prefer URL param
          if (joinCode && joinCode.toUpperCase() !== parsed.code) {
            // New join intent
          } else {
            setMyPlayerId(parsed.playerId);
            fetchRoomState(parsed.code, parsed.playerId);
            return;
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchRoomState = async (code: string, currentPid?: string) => {
    try {
      const res = await fetch(`/api/rooms/${code}`);
      const data = await res.json();
      if (data.success && data.room) {
        setRoom(data.room);
        if (currentPid) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, playerId: currentPid }));
        }
        setupSSE(code);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Offline fallback: room remains cached in state
    }
  };

  // 2. Real-time Server-Sent Events (SSE) connection
  const setupSSE = (code: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/rooms/${code}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const updatedRoom: Room = JSON.parse(event.data);
        setRoom((prevRoom) => {
          // Detect turn switch to current user
          if (
            lastTurnPlayerIdRef.current !== updatedRoom.currentTurnPlayerId &&
            updatedRoom.currentTurnPlayerId === myPlayerId
          ) {
            haptics.turnSwitched();
            showToast("It's your turn to pick the aux song!");
          }
          lastTurnPlayerIdRef.current = updatedRoom.currentTurnPlayerId;
          return updatedRoom;
        });
      } catch {
        // Heartbeat or parse error
      }
    };

    es.onerror = () => {
      // Reconnect automatically handled by EventSource
    };
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // 3. Create Room (Host)
  const handleCreateRoom = async (hostNickname: string, sessionName: string, capSeconds: number) => {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostNickname, sessionName, maxDurationCapSeconds: capSeconds }),
    });
    const data = await res.json();
    if (data.success) {
      setRoom(data.room);
      setMyPlayerId(data.playerId);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ code: data.room.code, playerId: data.playerId })
      );
      setupSSE(data.room.code);
      showToast(`Trip created! Room code: ${data.room.code}`);
    }
  };

  // 4. Join Room (Guest)
  const handleJoinRoom = async (code: string, nickname: string, avatar: string) => {
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, avatar }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
        setMyPlayerId(data.playerId);
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ code: data.room.code, playerId: data.playerId })
        );
        setupSSE(data.room.code);
        showToast(`Joined ${data.room.name}!`);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch {
      return { success: false, error: 'Network error joining room' };
    }
  };

  // 5. Add Track to Queue (Strict Input Locking & Duration Cap)
  const handleQueueTrack = async (track: SearchTrackResult) => {
    if (!room) return { success: false, error: 'No active room' };

    try {
      const res = await fetch(`/api/rooms/${room.code}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: myPlayerId, track }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
        showToast(data.message || 'Track queued successfully!');
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch {
      return { success: false, error: 'Network error adding track' };
    }
  };

  // 6. Playback Action (Host)
  const handlePlaybackAction = async (action: 'play' | 'pause' | 'next' | 'previous' | 'seek', positionMs?: number) => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}/playback/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: myPlayerId, action, positionMs }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
      }
    } catch {
      // Ignore
    }
  };

  // 7. Cast Democratic Veto
  const handleCastVeto = async () => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}/veto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: myPlayerId }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
        showToast(data.message);
      } else {
        showToast(data.error || 'Failed to cast veto');
      }
    } catch {
      showToast('Network error casting veto');
    }
  };

  // 8. Pass Turn
  const handlePassTurn = async () => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}/pass-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: myPlayerId }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
        showToast('Turn passed to next passenger.');
      }
    } catch {
      // Ignore
    }
  };

  // 9. Update Settings (Host)
  const handleUpdateSettings = async (settings: { maxDurationCapSeconds: number; vetoBudget: number; name: string }) => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: myPlayerId, ...settings }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
        showToast('Room rules updated!');
      }
    } catch {
      // Ignore
    }
  };

  // 10. Simulate Passenger
  const handleSimulatePassenger = async () => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}/simulate-passenger`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
        showToast(`${data.player.nickname} joined the car!`);
      }
    } catch {
      // Ignore
    }
  };

  // 11. Remove Track (Host)
  const handleRemoveTrack = async (trackId: string) => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}/queue/${trackId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: myPlayerId }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
      }
    } catch {
      // Ignore
    }
  };

  // 12. Disconnect Spotify
  const handleDisconnectSpotify = async () => {
    if (!room) return;
    try {
      const res = await fetch('/api/spotify/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: room.code, hostId: myPlayerId }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
        showToast('Spotify disconnected.');
      }
    } catch {
      showToast('Failed to disconnect Spotify');
    }
  };

  // 13. Leave Room
  const handleLeaveRoom = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    localStorage.removeItem(STORAGE_KEY);
    setRoom(null);
    setMyPlayerId('');
    showToast('Left session.');
  };

  const isHost = room ? room.hostId === myPlayerId : false;
  const isMyTurn = room ? room.currentTurnPlayerId === myPlayerId : false;
  const activePlayer = room ? room.players[room.currentTurnPlayerId] : null;

  // Extract URL join param if present
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const queryJoinCode = urlParams?.get('join') || urlParams?.get('code') || '';

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Offline Toast Notification */}
      <OfflineIndicator />

      {/* Floating Apple-Style Feedback Toast */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold shadow-xl border border-white/10 animate-fadeIn">
          {toastMessage}
        </div>
      )}

      {/* Frosted Apple Navigation Header */}
      <Header
        roomCode={room?.code || ''}
        isHost={isHost}
        onOpenQR={() => setIsQROpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {!room ? (
          <JoinRoomView
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            initialCode={queryJoinCode}
          />
        ) : (
          <div className="space-y-6">
            {/* 1. Turn Queue Status Bar (Strict Round-Robin indicator) */}
            <TurnQueueBar
              turnOrder={room.turnOrder}
              players={room.players}
              currentTurnPlayerId={room.currentTurnPlayerId}
              myPlayerId={myPlayerId}
              onOpenSearch={() => setIsSearchOpen(true)}
              onPassTurn={handlePassTurn}
            />

            {/* 2. Now Playing Live Aux Player & Democratic Veto Bar */}
            <NowPlayingCard
              playback={room.playback}
              players={room.players}
              myPlayerId={myPlayerId}
              isHost={isHost}
              spotifyConnected={room.spotifyConfig?.connected}
              onPlaybackAction={handlePlaybackAction}
              onCastVeto={handleCastVeto}
            />

            {/* 3. Upcoming Aux Queue List */}
            <QueueList
              queue={room.queue}
              isHost={isHost}
              onRemoveTrack={handleRemoveTrack}
              onOpenSearch={() => setIsSearchOpen(true)}
              isMyTurn={isMyTurn}
              activePlayerNickname={activePlayer?.nickname || 'Current passenger'}
            />
          </div>
        )}
      </main>

      {/* Apple-style Modals */}
      {room && (
        <>
          <SearchSongModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onQueueTrack={handleQueueTrack}
            maxDurationCapSeconds={room.maxDurationCapSeconds}
            isMyTurn={isMyTurn}
            activePlayerNickname={activePlayer?.nickname || 'Current passenger'}
          />

          <QRCodeModal
            roomCode={room.code}
            roomName={room.name}
            isOpen={isQROpen}
            onClose={() => setIsQROpen(false)}
          />

          <HostControlsModal
            room={room}
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onUpdateSettings={handleUpdateSettings}
            onSimulatePassenger={handleSimulatePassenger}
            onDisconnectSpotify={handleDisconnectSpotify}
          />
        </>
      )}

      {/* Subtle Apple Footer */}
      <footer className="py-6 border-t border-slate-100 text-center text-xs text-slate-400">
        <p>FairPlay &bull; Democratic aux queue with strict round-robin turns</p>
      </footer>
    </div>
  );
}
