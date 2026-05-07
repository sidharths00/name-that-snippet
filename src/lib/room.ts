import { generateRoomCode } from "./code";
import { getStore } from "./store";
import type { Player, PublicRoom, Room, RoomSettings, Track } from "./types";
import type { SimpleTrack } from "./spotify";

export const DEFAULT_SETTINGS: RoomSettings = {
  gameMode: "race",
  playbackMode: "everyone",
  rounds: 10,
  snippetSeconds: 20,
  uniqueTrackRatio: 0.2,
};

function toTrack(t: SimpleTrack, ownerId: string): Track {
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    artists: t.artists,
    durationMs: t.durationMs,
    previewUrl: t.previewUrl,
    albumImage: t.albumImage,
    ownerIds: [ownerId],
  };
}

export async function createRoom(
  host: Player,
  settings: Partial<RoomSettings>,
  hostLibrary: SimpleTrack[],
): Promise<Room> {
  const store = getStore();
  let code = "";
  for (let i = 0; i < 8; i++) {
    code = generateRoomCode();
    const existing = await store.getRoom(code);
    if (!existing) break;
    code = "";
  }
  if (!code) throw new Error("Failed to allocate room code");

  const now = Date.now();
  const room: Room = {
    code,
    hostId: host.id,
    status: "lobby",
    settings: { ...DEFAULT_SETTINGS, ...settings },
    players: [{ ...host, isHost: true, score: 0, joinedAt: now }],
    songPool: [],
    rounds: [],
    libraryByPlayer: { [host.id]: hostLibrary.map((t) => toTrack(t, host.id)) },
    usedTrackIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await store.setRoom(room);
  return room;
}

export async function joinRoom(
  code: string,
  player: Player,
  library: SimpleTrack[],
): Promise<Room> {
  const store = getStore();
  const room = await store.getRoom(code);
  if (!room) throw new Error("Room not found");
  if (room.status !== "lobby") throw new Error("Game already in progress");

  const existing = room.players.find((p) => p.id === player.id);
  if (!existing) {
    room.players.push({
      ...player,
      isHost: false,
      score: 0,
      joinedAt: Date.now(),
    });
  }
  room.libraryByPlayer[player.id] = library.map((t) => toTrack(t, player.id));
  room.updatedAt = Date.now();
  await store.setRoom(room);
  await store.publish(code, { type: "room-updated", room, at: Date.now() });
  return room;
}

export async function leaveRoom(code: string, playerId: string): Promise<Room | null> {
  const store = getStore();
  const room = await store.getRoom(code);
  if (!room) return null;
  room.players = room.players.filter((p) => p.id !== playerId);
  delete room.libraryByPlayer[playerId];
  if (room.players.length === 0) {
    await store.deleteRoom(code);
    return null;
  }
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }
  room.updatedAt = Date.now();
  await store.setRoom(room);
  await store.publish(code, { type: "room-updated", room, at: Date.now() });
  return room;
}

export function publicRoom(room: Room, _viewerId: string | null): PublicRoom {
  const activeRound = room.rounds[room.rounds.length - 1] ?? null;
  const reveal = room.status === "round-result" || room.status === "finished";

  let currentTrack: PublicRoom["currentTrack"] = null;
  if (activeRound) {
    const track = room.songPool.find((t) => t.id === activeRound.trackId);
    if (track) {
      const ownerNames = track.ownerIds
        .map((id) => room.players.find((p) => p.id === id)?.name)
        .filter((n): n is string => !!n);
      currentTrack = {
        id: track.id,
        uri: track.uri,
        durationMs: track.durationMs,
        previewUrl: track.previewUrl,
        name: reveal ? track.name : null,
        artists: reveal ? track.artists : null,
        albumImage: reveal ? track.albumImage : null,
        ownerNames,
      };
    }
  }

  const { songPool: _pool, libraryByPlayer: _lib, ...rest } = room;
  return {
    ...rest,
    songPoolSize: room.songPool.length,
    currentTrack,
  };
}
