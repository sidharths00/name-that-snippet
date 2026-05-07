export type GameMode = "race" | "turns";
export type PlaybackMode = "host-only" | "everyone";
export type RoomStatus = "lobby" | "loading-songs" | "in-round" | "round-result" | "finished";

export interface Player {
  id: string;
  name: string;
  image: string | null;
  isHost: boolean;
  isPremium: boolean;
  score: number;
  joinedAt: number;
}

export interface RoomSettings {
  gameMode: GameMode;
  playbackMode: PlaybackMode;
  rounds: number;
  snippetSeconds: number;
  uniqueTrackRatio: number;
}

export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  durationMs: number;
  previewUrl: string | null;
  ownerIds: string[];
}

export interface RoundGuess {
  playerId: string;
  guess: string;
  at: number;
  titleHit: boolean;
  artistHit: boolean;
  points: number;
}

export interface Round {
  index: number;
  trackId: string;
  startedAt: number | null;
  endedAt: number | null;
  activePlayerId: string | null;
  guesses: RoundGuess[];
  winnerId: string | null;
}

export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: Player[];
  songPool: Track[];
  rounds: Round[];
  // Per-player library samples gathered at join time. Server-only; stripped
  // from any payload sent to clients.
  libraryByPlayer: Record<string, Track[]>;
  createdAt: number;
  updatedAt: number;
}

// Shape sent to clients: hides upcoming track titles and the per-player
// libraries that we used to build the pool.
export interface PublicRoom extends Omit<Room, "songPool" | "libraryByPlayer"> {
  songPoolSize: number;
  currentTrack: {
    id: string;
    uri: string;
    durationMs: number;
    previewUrl: string | null;
    name: string | null;
    artists: string[] | null;
    ownerNames: string[];
  } | null;
}

export interface GameEvent {
  type:
    | "room-updated"
    | "round-started"
    | "round-ended"
    | "guess-submitted"
    | "game-finished"
    | "ping";
  room?: Room;
  data?: unknown;
  at: number;
}

export interface PublicGameEvent extends Omit<GameEvent, "room"> {
  room?: PublicRoom;
}
