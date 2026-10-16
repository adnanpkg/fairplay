import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Spotify Application Credentials
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '1589be04d9ed4f87b84d220ba79152f2';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '17eea313f6f34bd9ae67f6e2ccf7ed76';

interface Player {
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

interface Track {
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

interface PlaybackState {
  isPlaying: boolean;
  currentTrack: Track | null;
  positionMs: number;
  durationMs: number;
  updatedAt: number;
}

interface SpotifySession {
  connected: boolean;
  userDisplayName?: string;
  product?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  lastQueuedTrackTitle?: string;
}

interface Room {
  code: string;
  name: string;
  createdAt: number;
  hostId: string;
  maxDurationCapSeconds: number; // default 300 (5 minutes)
  vetoBudget: number; // default 2
  turnOrder: string[]; // Circular array of player IDs
  currentTurnPlayerId: string;
  players: Record<string, Player>;
  queue: Track[];
  history: Track[];
  playback: PlaybackState;
  spotifyConfig: SpotifySession;
}

// In-memory rooms repository
const rooms: Record<string, Room> = {};
// SSE clients connected per room code
const sseClients: Record<string, Response[]> = {};

// Cached Spotify Client Credentials Token for search operations
let spotifyClientTokenCache: { token: string; expiresAt: number } | null = null;

async function getSpotifyClientToken(): Promise<string | null> {
  if (spotifyClientTokenCache && spotifyClientTokenCache.expiresAt > Date.now() + 60000) {
    return spotifyClientTokenCache.token;
  }

  return new Promise((resolve) => {
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const req = https.request('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.access_token) {
            spotifyClientTokenCache = {
              token: data.access_token,
              expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
            };
            resolve(data.access_token);
          } else {
            console.error('Spotify token error response:', data);
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Spotify token network error:', e);
      resolve(null);
    });

    req.write('grant_type=client_credentials');
    req.end();
  });
}

// Push Track to Host's Spotify Queue
async function pushToSpotifyQueue(accessToken: string, spotifyUri: string): Promise<boolean> {
  return new Promise((resolve) => {
    const encodedUri = encodeURIComponent(spotifyUri);
    const req = https.request(`https://api.spotify.com/v1/me/player/queue?uri=${encodedUri}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': '0',
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    req.on('error', () => resolve(false));
    req.end();
  });
}

// Remote playback control for connected Spotify Host
async function sendSpotifyPlaybackCommand(accessToken: string, action: 'play' | 'pause' | 'next'): Promise<void> {
  let endpoint = 'https://api.spotify.com/v1/me/player/play';
  let method = 'PUT';

  if (action === 'pause') {
    endpoint = 'https://api.spotify.com/v1/me/player/pause';
    method = 'PUT';
  } else if (action === 'next') {
    endpoint = 'https://api.spotify.com/v1/me/player/next';
    method = 'POST';
  }

  const parsedUrl = new URL(endpoint);
  const req = https.request({
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname,
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Length': '0',
    },
  }, () => {});

  req.on('error', () => {});
  req.end();
}

function broadcastRoom(code: string) {
  const room = rooms[code];
  if (!room) return;
  const clients = sseClients[code] || [];
  
  // Strip sensitive tokens before sending to clients
  const sanitizedRoom = {
    ...room,
    spotifyConfig: {
      connected: room.spotifyConfig.connected,
      userDisplayName: room.spotifyConfig.userDisplayName,
      product: room.spotifyConfig.product,
      lastQueuedTrackTitle: room.spotifyConfig.lastQueuedTrackTitle,
    },
  };

  const payload = `data: ${JSON.stringify(sanitizedRoom)}\n\n`;
  for (let i = clients.length - 1; i >= 0; i--) {
    try {
      clients[i].write(payload);
    } catch {
      clients.splice(i, 1);
    }
  }
}

function generateRoomCode(): string {
  const words = ['ROAD', 'WAVE', 'AUX1', 'CRUZ', 'VIBE', 'BEAT', 'PLAY', 'TRIP', 'FLOW', 'BASS'];
  let candidate = words[Math.floor(Math.random() * words.length)] + Math.floor(10 + Math.random() * 90);
  let attempts = 0;
  while (rooms[candidate] && attempts < 20) {
    candidate = words[Math.floor(Math.random() * words.length)] + Math.floor(10 + Math.random() * 90);
    attempts++;
  }
  return candidate;
}

function advanceTurn(room: Room): string {
  const activeOrder = room.turnOrder.filter(id => room.players[id]);
  if (activeOrder.length === 0) return '';
  const currentIndex = activeOrder.indexOf(room.currentTurnPlayerId);
  const nextIndex = (currentIndex + 1) % activeOrder.length;
  room.currentTurnPlayerId = activeOrder[nextIndex];
  return room.currentTurnPlayerId;
}

function createInitialRoom(hostNickname = 'Road Host', sessionName = 'Pacific Coast Highway Cruise'): Room {
  const code = generateRoomCode();
  const hostId = 'p_' + Math.random().toString(36).substring(2, 9);
  
  const hostPlayer: Player = {
    id: hostId,
    nickname: hostNickname,
    avatar: '🚗',
    color: '#6366F1',
    role: 'host',
    vetosRemaining: 2,
    joinedAt: Date.now(),
    isOnline: true,
  };

  const buddyId = 'p_buddy_sam';
  const buddyPlayer: Player = {
    id: buddyId,
    nickname: 'Sam (Co-Pilot)',
    avatar: '🎸',
    color: '#EC4899',
    role: 'guest',
    vetosRemaining: 2,
    joinedAt: Date.now() + 10,
    isOnline: true,
    isSimulated: true,
  };

  const starterTrack: Track = {
    id: 'starter_midnight_city',
    title: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    albumArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop',
    durationMs: 243000,
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/4a/c0/8b/4ac08b88-1428-ec6e-1da5-6c7c0018a36c/mzaf_1052608404284568600.plus.aac.p.m4a',
    spotifyUri: 'spotify:track:1eyzqe2QqGZUmfcPZtrIyt',
    externalUrl: 'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt',
    addedBy: {
      id: hostId,
      nickname: hostNickname,
      avatar: '🚗',
    },
    addedAt: Date.now(),
    vetoVoterIds: [],
  };

  const room: Room = {
    code,
    name: sessionName,
    createdAt: Date.now(),
    hostId,
    maxDurationCapSeconds: 300,
    vetoBudget: 2,
    turnOrder: [hostId, buddyId],
    currentTurnPlayerId: hostId,
    players: {
      [hostId]: hostPlayer,
      [buddyId]: buddyPlayer,
    },
    queue: [
      {
        id: 'starter_sunflower',
        title: 'Sunflower',
        artist: 'Post Malone & Swae Lee',
        album: 'Spider-Man: Into the Spider-Verse',
        albumArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop',
        durationMs: 158000,
        previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/64/46/7d/64467d16-6419-f542-ec0d-ecf7ad082ae0/mzaf_6755455829624536630.plus.aac.p.m4a',
        spotifyUri: 'spotify:track:3KkXRQHbMCARz0aVfEt68P',
        externalUrl: 'https://open.spotify.com/track/3KkXRQHbMCARz0aVfEt68P',
        addedBy: {
          id: buddyId,
          nickname: 'Sam (Co-Pilot)',
          avatar: '🎸',
        },
        addedAt: Date.now() + 50,
        vetoVoterIds: [],
      }
    ],
    history: [],
    playback: {
      isPlaying: false,
      currentTrack: starterTrack,
      positionMs: 0,
      durationMs: starterTrack.durationMs,
      updatedAt: Date.now(),
    },
    spotifyConfig: {
      connected: false,
    },
  };

  rooms[code] = room;
  return room;
}

// Query official Spotify Web API search with iTunes audio preview fallback
async function searchCatalog(query: string): Promise<any[]> {
  const spotifyToken = await getSpotifyClientToken();

  if (spotifyToken) {
    try {
      const spotifyTracks: any[] = await new Promise((resolve) => {
        const encoded = encodeURIComponent(query);
        const req = https.request(`https://api.spotify.com/v1/search?q=${encoded}&type=track&limit=20`, {
          headers: {
            'Authorization': `Bearer ${spotifyToken}`,
          },
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.tracks?.items) {
                const tracks = data.tracks.items.map((item: any) => ({
                  id: item.id,
                  title: item.name,
                  artist: item.artists.map((a: any) => a.name).join(', '),
                  album: item.album.name,
                  albumArt: item.album.images?.[0]?.url || item.album.images?.[1]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop',
                  durationMs: item.duration_ms,
                  previewUrl: item.preview_url || null,
                  spotifyUri: item.uri,
                  externalUrl: item.external_urls?.spotify,
                }));
                resolve(tracks);
              } else {
                resolve([]);
              }
            } catch {
              resolve([]);
            }
          });
        });

        req.on('error', () => resolve([]));
        req.end();
      });

      if (spotifyTracks.length > 0) {
        return spotifyTracks;
      }
    } catch {
      // Fallback to secondary catalog
    }
  }

  // Secondary catalog fallback (guarantees 30-sec previews)
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(query);
    https.get(`https://itunes.apple.com/search?term=${encoded}&entity=song&limit=20`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const tracks = (parsed.results || []).map((item: any) => ({
            id: 'track_' + item.trackId,
            title: item.trackName || 'Unknown Title',
            artist: item.artistName || 'Unknown Artist',
            album: item.collectionName || '',
            albumArt: (item.artworkUrl100 || '').replace('100x100bb', '600x600bb') || item.artworkUrl100,
            durationMs: item.trackTimeMillis || 210000,
            previewUrl: item.previewUrl || null,
            spotifyUri: `spotify:track:${item.trackId}`,
            externalUrl: `https://open.spotify.com/search/${encodeURIComponent(item.trackName + ' ' + item.artistName)}`,
          }));
          resolve(tracks);
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // 1. Create Room
  app.post('/api/rooms', (req: Request, res: Response) => {
    const { hostNickname, sessionName, maxDurationCapSeconds } = req.body;
    const room = createInitialRoom(hostNickname || 'Driver', sessionName || 'Road Trip Jam');
    if (maxDurationCapSeconds && typeof maxDurationCapSeconds === 'number') {
      room.maxDurationCapSeconds = Math.min(Math.max(maxDurationCapSeconds, 120), 600);
    }
    res.json({
      success: true,
      room,
      playerId: room.hostId,
    });
  });

  // 2. Get Room State
  app.get('/api/rooms/:code', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = rooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found. Check your 4-to-6 digit code.' });
    }
    
    // Sanitize tokens
    const sanitizedRoom = {
      ...room,
      spotifyConfig: {
        connected: room.spotifyConfig.connected,
        userDisplayName: room.spotifyConfig.userDisplayName,
        product: room.spotifyConfig.product,
        lastQueuedTrackTitle: room.spotifyConfig.lastQueuedTrackTitle,
      },
    };

    res.json({ success: true, room: sanitizedRoom });
  });

  // 3. Join Room (Guest)
  app.post('/api/rooms/:code/join', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const { nickname, avatar, color } = req.body;
    const room = rooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found. Check code.' });
    }

    const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
    const guestPlayer: Player = {
      id: playerId,
      nickname: (nickname || 'Guest Passenger').trim(),
      avatar: avatar || '🎧',
      color: color || '#8B5CF6',
      role: 'guest',
      vetosRemaining: room.vetoBudget || 2,
      joinedAt: Date.now(),
      isOnline: true,
    };

    room.players[playerId] = guestPlayer;
    if (!room.turnOrder.includes(playerId)) {
      room.turnOrder.push(playerId);
    }

    broadcastRoom(code);
    res.json({
      success: true,
      room,
      playerId,
    });
  });

  // 4. Server-Sent Events (SSE) for Real-Time State Broadcast
  app.get('/api/rooms/:code/events', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = rooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sanitizedRoom = {
      ...room,
      spotifyConfig: {
        connected: room.spotifyConfig.connected,
        userDisplayName: room.spotifyConfig.userDisplayName,
        product: room.spotifyConfig.product,
        lastQueuedTrackTitle: room.spotifyConfig.lastQueuedTrackTitle,
      },
    };

    res.write(`data: ${JSON.stringify(sanitizedRoom)}\n\n`);

    if (!sseClients[code]) {
      sseClients[code] = [];
    }
    sseClients[code].push(res);

    const interval = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(interval);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(interval);
      if (sseClients[code]) {
        sseClients[code] = sseClients[code].filter(c => c !== res);
      }
    });
  });

  // 5. Add to Queue (STRICT ROUND-ROBIN INPUT LOCKING & DURATION CAP)
  app.post('/api/rooms/:code/queue', async (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const { playerId, track } = req.body;
    const room = rooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const player = room.players[playerId];
    if (!player) {
      return res.status(403).json({ error: 'Player is not registered in this room.' });
    }

    // STRICT INPUT LOCKING CHECK: Is it this player's turn?
    if (room.currentTurnPlayerId !== playerId) {
      const activePlayer = room.players[room.currentTurnPlayerId];
      return res.status(403).json({
        error: `Input Locked: It is currently ${activePlayer ? activePlayer.nickname : 'another player'}'s turn to pick the aux track!`,
      });
    }

    // DURATION CAP VALIDATION: Anti-Abuse
    const maxMs = room.maxDurationCapSeconds * 1000;
    if (track.durationMs > maxMs) {
      const capMin = Math.floor(room.maxDurationCapSeconds / 60);
      const capSec = room.maxDurationCapSeconds % 60;
      const formattedCap = `${capMin}:${capSec.toString().padStart(2, '0')}`;
      return res.status(400).json({
        error: `Track exceeds the maximum room limit of ${formattedCap}. Please pick a song under ${formattedCap} to keep the aux moving fairly!`,
      });
    }

    const newTrack: Track = {
      id: track.id || 'track_' + Math.random().toString(36).substring(2, 8),
      title: track.title,
      artist: track.artist,
      album: track.album || '',
      albumArt: track.albumArt || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop',
      durationMs: track.durationMs,
      previewUrl: track.previewUrl || null,
      spotifyUri: track.spotifyUri || `spotify:track:${track.id}`,
      externalUrl: track.externalUrl || `https://open.spotify.com/track/${track.id}`,
      addedBy: {
        id: player.id,
        nickname: player.nickname,
        avatar: player.avatar,
      },
      addedAt: Date.now(),
      vetoVoterIds: [],
    };

    // If nothing currently playing, play this song directly
    if (!room.playback.currentTrack) {
      room.playback.currentTrack = newTrack;
      room.playback.isPlaying = true;
      room.playback.positionMs = 0;
      room.playback.durationMs = newTrack.durationMs;
      room.playback.updatedAt = Date.now();
    } else {
      room.queue.push(newTrack);
    }

    // SECTION 4.C: If Host has connected Spotify account, push track directly to Spotify queue!
    let spotifyPushed = false;
    if (room.spotifyConfig?.connected && room.spotifyConfig.accessToken) {
      spotifyPushed = await pushToSpotifyQueue(room.spotifyConfig.accessToken, newTrack.spotifyUri);
      if (spotifyPushed) {
        room.spotifyConfig.lastQueuedTrackTitle = newTrack.title;
      }
    }

    // TURN ADVANCEMENT: Strict Round-Robin sequence advance
    const nextPlayerId = advanceTurn(room);

    broadcastRoom(code);
    res.json({
      success: true,
      room,
      spotifyPushed,
      nextTurnPlayerId: nextPlayerId,
      message: spotifyPushed
        ? `Track queued & pushed to Spotify! Aux turn advanced to ${room.players[nextPlayerId]?.nickname || 'next player'}.`
        : `Track queued! Aux turn advanced to ${room.players[nextPlayerId]?.nickname || 'next player'}.`,
    });
  });

  // 6. Playback controls (Host)
  app.post('/api/rooms/:code/playback/action', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const { playerId, action, positionMs } = req.body;
    const room = rooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Mirror to Spotify playback if Host has Spotify connected
    if (room.spotifyConfig?.connected && room.spotifyConfig.accessToken) {
      if (action === 'play' || action === 'pause' || action === 'next') {
        sendSpotifyPlaybackCommand(room.spotifyConfig.accessToken, action).catch(() => {});
      }
    }

    if (action === 'play') {
      room.playback.isPlaying = true;
      room.playback.updatedAt = Date.now();
    } else if (action === 'pause') {
      room.playback.isPlaying = false;
      room.playback.updatedAt = Date.now();
    } else if (action === 'seek' && typeof positionMs === 'number') {
      room.playback.positionMs = positionMs;
      room.playback.updatedAt = Date.now();
    } else if (action === 'next') {
      if (room.playback.currentTrack) {
        room.history.unshift(room.playback.currentTrack);
        if (room.history.length > 20) room.history.pop();
      }

      if (room.queue.length > 0) {
        const nextTrack = room.queue.shift()!;
        room.playback.currentTrack = nextTrack;
        room.playback.isPlaying = true;
        room.playback.positionMs = 0;
        room.playback.durationMs = nextTrack.durationMs;
        room.playback.updatedAt = Date.now();
      } else {
        room.playback.currentTrack = null;
        room.playback.isPlaying = false;
        room.playback.positionMs = 0;
      }
    } else if (action === 'previous') {
      if (room.history.length > 0) {
        if (room.playback.currentTrack) {
          room.queue.unshift(room.playback.currentTrack);
        }
        const prevTrack = room.history.shift()!;
        room.playback.currentTrack = prevTrack;
        room.playback.isPlaying = true;
        room.playback.positionMs = 0;
        room.playback.durationMs = prevTrack.durationMs;
        room.playback.updatedAt = Date.now();
      }
    }

    broadcastRoom(code);
    res.json({ success: true, room });
  });

  // 7. Democratic Veto / Skip Budget
  app.post('/api/rooms/:code/veto', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const { playerId } = req.body;
    const room = rooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const player = room.players[playerId];
    if (!player) {
      return res.status(403).json({ error: 'Player not found in room' });
    }

    const currentTrack = room.playback.currentTrack;
    if (!currentTrack) {
      return res.status(400).json({ error: 'No track is currently playing' });
    }

    if (currentTrack.vetoVoterIds.includes(playerId)) {
      return res.status(400).json({ error: 'You have already voted to veto this song!' });
    }

    if (player.vetosRemaining <= 0) {
      return res.status(400).json({ error: 'You have exhausted your veto budget for this road trip!' });
    }

    player.vetosRemaining -= 1;
    currentTrack.vetoVoterIds.push(playerId);

    const totalPlayers = Object.keys(room.players).length;
    const requiredVotes = totalPlayers <= 2 ? 1 : Math.ceil(totalPlayers * 0.5);

    let skipped = false;
    if (currentTrack.vetoVoterIds.length >= requiredVotes) {
      skipped = true;
      room.history.unshift(currentTrack);

      if (room.spotifyConfig?.connected && room.spotifyConfig.accessToken) {
        sendSpotifyPlaybackCommand(room.spotifyConfig.accessToken, 'next').catch(() => {});
      }

      if (room.queue.length > 0) {
        const nextTrack = room.queue.shift()!;
        room.playback.currentTrack = nextTrack;
        room.playback.isPlaying = true;
        room.playback.positionMs = 0;
        room.playback.durationMs = nextTrack.durationMs;
        room.playback.updatedAt = Date.now();
      } else {
        room.playback.currentTrack = null;
        room.playback.isPlaying = false;
        room.playback.positionMs = 0;
      }
    }

    broadcastRoom(code);
    res.json({
      success: true,
      room,
      vetosRemaining: player.vetosRemaining,
      votesCount: currentTrack.vetoVoterIds.length,
      requiredVotes,
      skipped,
      message: skipped
        ? 'Democratic Veto Passed! Track skipped.'
        : `Veto registered (${currentTrack.vetoVoterIds.length}/${requiredVotes} needed to skip).`,
    });
  });

  // 8. Pass Turn or Host Manual Advance
  app.post('/api/rooms/:code/pass-turn', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const { playerId } = req.body;
    const room = rooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.hostId !== playerId && room.currentTurnPlayerId !== playerId) {
      return res.status(403).json({ error: 'Only the active player or host can pass this turn.' });
    }

    const nextId = advanceTurn(room);
    broadcastRoom(code);
    res.json({
      success: true,
      room,
      nextTurnPlayerId: nextId,
    });
  });

  // 9. Update Room Settings (Host only)
  app.post('/api/rooms/:code/settings', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const { hostId, maxDurationCapSeconds, vetoBudget, name } = req.body;
    const room = rooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.hostId !== hostId) {
      return res.status(403).json({ error: 'Only the host can modify room settings' });
    }

    if (typeof maxDurationCapSeconds === 'number') {
      room.maxDurationCapSeconds = Math.min(Math.max(maxDurationCapSeconds, 120), 600);
    }
    if (typeof vetoBudget === 'number') {
      room.vetoBudget = Math.min(Math.max(vetoBudget, 1), 5);
    }
    if (name && typeof name === 'string') {
      room.name = name.trim();
    }

    broadcastRoom(code);
    res.json({ success: true, room });
  });

  // 10. Simulate Passenger
  app.post('/api/rooms/:code/simulate-passenger', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const room = rooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const candidates = [
      { name: 'Alex (Backseat)', avatar: '🎧', color: '#3B82F6' },
      { name: 'Jordan (DJ Vibe)', avatar: '🪩', color: '#10B981' },
      { name: 'Taylor (Aux Ace)', avatar: '⚡', color: '#F59E0B' },
      { name: 'Morgan (Navigator)', avatar: '🌴', color: '#06B6D4' },
      { name: 'Riley (Beat Drop)', avatar: '🚀', color: '#8B5CF6' },
    ];

    const existingNames = Object.values(room.players).map(p => p.nickname);
    const available = candidates.filter(c => !existingNames.includes(c.name));
    const pick = available[0] || candidates[Math.floor(Math.random() * candidates.length)];

    const id = 'sim_' + Math.random().toString(36).substring(2, 8);
    const player: Player = {
      id,
      nickname: pick.name,
      avatar: pick.avatar,
      color: pick.color,
      role: 'guest',
      vetosRemaining: room.vetoBudget,
      joinedAt: Date.now(),
      isOnline: true,
      isSimulated: true,
    };

    room.players[id] = player;
    room.turnOrder.push(id);

    broadcastRoom(code);
    res.json({ success: true, room, player });
  });

  // 11. Remove / Reorder Queue Item (Host only)
  app.delete('/api/rooms/:code/queue/:trackId', (req: Request, res: Response) => {
    const code = req.params.code.toUpperCase();
    const { hostId } = req.body;
    const { trackId } = req.params;
    const room = rooms[code];
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.hostId !== hostId) {
      return res.status(403).json({ error: 'Host permissions required' });
    }

    room.queue = room.queue.filter(t => t.id !== trackId);
    broadcastRoom(code);
    res.json({ success: true, room });
  });

  // 12. Music Catalog Search Proxy (Uses official Spotify API powered by provided client_id and client_secret)
  app.get('/api/music/search', async (req: Request, res: Response) => {
    const query = (req.query.q as string) || '';
    if (!query.trim()) {
      return res.json({ results: [] });
    }
    const results = await searchCatalog(query);
    res.json({ results });
  });

  // 13. SPOTIFY OAUTH FLOW FOR HOST (ADMIN)
  // Step A: Initiate Spotify Login
  app.get('/api/spotify/login', (req: Request, res: Response) => {
    const roomCode = ((req.query.roomCode as string) || '').toUpperCase();
    const hostProtocol = req.headers['x-forwarded-proto'] || req.protocol;
    const hostDomain = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = `${hostProtocol}://${hostDomain}/api/spotify/callback`;

    const scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'streaming',
      'playlist-read-private',
    ].join(' ');

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(roomCode)}`;

    res.redirect(authUrl);
  });

  // Step B: Spotify OAuth Callback
  app.get('/api/spotify/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const roomCode = ((req.query.state as string) || '').toUpperCase();
    const hostProtocol = req.headers['x-forwarded-proto'] || req.protocol;
    const hostDomain = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = `${hostProtocol}://${hostDomain}/api/spotify/callback`;

    if (!code) {
      return res.redirect(`/?error=spotify_auth_failed`);
    }

    try {
      const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString();

      const tokenData: any = await new Promise((resolve, reject) => {
        const tokenReq = https.request('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`,
            'Content-Length': Buffer.byteLength(tokenBody),
          },
        }, (tokenRes) => {
          let b = '';
          tokenRes.on('data', d => b += d);
          tokenRes.on('end', () => {
            try {
              resolve(JSON.parse(b));
            } catch (err) {
              reject(err);
            }
          });
        });
        tokenReq.on('error', reject);
        tokenReq.write(tokenBody);
        tokenReq.end();
      });

      if (tokenData.access_token) {
        // Fetch User Profile
        const profileData: any = await new Promise((resolve) => {
          const profileReq = https.request('https://api.spotify.com/v1/me', {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
          }, (pRes) => {
            let pb = '';
            pRes.on('data', d => pb += d);
            pRes.on('end', () => {
              try {
                resolve(JSON.parse(pb));
              } catch {
                resolve({});
              }
            });
          });
          profileReq.on('error', () => resolve({}));
          profileReq.end();
        });

        // Store into room if room exists
        const targetRoom = rooms[roomCode];
        if (targetRoom) {
          targetRoom.spotifyConfig = {
            connected: true,
            userDisplayName: profileData.display_name || 'Spotify User',
            product: profileData.product || 'premium',
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
          };
          broadcastRoom(roomCode);
        }

        return res.redirect(`/?code=${roomCode}&spotify=connected`);
      }
    } catch (err) {
      console.error('Spotify OAuth callback processing error:', err);
    }

    res.redirect(`/?code=${roomCode}&error=spotify_token_error`);
  });

  // Step C: Spotify Disconnect
  app.post('/api/spotify/disconnect', (req: Request, res: Response) => {
    const { roomCode, hostId } = req.body;
    const room = rooms[(roomCode || '').toUpperCase()];
    if (!room || room.hostId !== hostId) {
      return res.status(403).json({ error: 'Host permissions required' });
    }

    room.spotifyConfig = {
      connected: false,
    };
    broadcastRoom(room.code);
    res.json({ success: true, room });
  });

  // Step D: Spotify Integration Info
  app.get('/api/spotify/config', (req: Request, res: Response) => {
    const hostProtocol = req.headers['x-forwarded-proto'] || req.protocol;
    const hostDomain = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = `${hostProtocol}://${hostDomain}/api/spotify/callback`;

    res.json({
      clientId: SPOTIFY_CLIENT_ID,
      redirectUri,
      hasCredentials: Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET),
    });
  });

  // Mount Vite or static build
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FairPlay PWA dev server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
