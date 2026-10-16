export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  color: string;
  role: 'host' | 'guest';
  vetosRemaining: number;
  joinedAt: number;
  isOnline: boolean;
  isSimulated?: boolean;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  durationMs: number;
  previewUrl: string | null;
  spotifyUri: string;
  externalUrl?: string;
  addedBy: {
    id: string;
    nickname: string;
    avatar: string;
  };
  addedAt: number;
  vetoVoterIds: string[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTrack: Track | null;
  positionMs: number;
  durationMs: number;
  updatedAt: number;
}

export interface Room {
  code: string;
  name: string;
  createdAt: number;
  hostId: string;
  maxDurationCapSeconds: number; // e.g. 300 (5 minutes)
  vetoBudget: number; // e.g. 2
  turnOrder: string[]; // List of player IDs in round-robin order
  currentTurnPlayerId: string;
  players: Record<string, Player>;
  queue: Track[];
  history: Track[];
  playback: PlaybackState;
  spotifyConfig: {
    connected: boolean;
    userDisplayName?: string;
    product?: string;
    lastQueuedTrackTitle?: string;
    deviceId?: string;
  };
}

export interface SearchTrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  durationMs: number;
  previewUrl: string | null;
  spotifyUri: string;
  externalUrl?: string;
}
