import { describe, expect, test } from "vitest";
import { createRoom, joinRoom, leaveRoom, publicRoom, DEFAULT_SETTINGS } from "./room";
import type { Player } from "./types";
import type { SimpleTrack } from "./spotify";

function p(id: string): Player {
  return {
    id,
    name: id,
    image: null,
    isHost: false,
    isPremium: true,
    score: 0,
    joinedAt: 0,
  };
}

const T: SimpleTrack[] = [
  {
    id: "1",
    uri: "spotify:track:1",
    name: "Track 1",
    artists: ["Artist 1"],
    durationMs: 200_000,
    previewUrl: null,
  },
];

describe("createRoom", () => {
  test("issues a 4-char code", async () => {
    const room = await createRoom(p("host"), {}, T);
    expect(room.code).toMatch(/^[A-Z2-9]{4}$/);
  });
  test("seeds host as the only player and marks them host", async () => {
    const room = await createRoom(p("host"), {}, T);
    expect(room.players).toHaveLength(1);
    expect(room.players[0].isHost).toBe(true);
    expect(room.hostId).toBe("host");
  });
  test("merges settings with defaults", async () => {
    const room = await createRoom(p("host"), { rounds: 5 }, T);
    expect(room.settings.rounds).toBe(5);
    expect(room.settings.gameMode).toBe(DEFAULT_SETTINGS.gameMode);
    expect(room.settings.snippetSeconds).toBe(DEFAULT_SETTINGS.snippetSeconds);
  });
  test("stores host library under their id", async () => {
    const room = await createRoom(p("host"), {}, T);
    expect(room.libraryByPlayer.host).toHaveLength(T.length);
    expect(room.libraryByPlayer.host[0].ownerIds).toEqual(["host"]);
  });
});

describe("joinRoom", () => {
  test("adds a new player", async () => {
    const room = await createRoom(p("host"), {}, T);
    const updated = await joinRoom(room.code, p("alice"), T);
    expect(updated.players).toHaveLength(2);
    expect(updated.players.find((pl) => pl.id === "alice")).toBeTruthy();
  });
  test("idempotent: same player joining twice doesn't duplicate", async () => {
    const room = await createRoom(p("host"), {}, T);
    await joinRoom(room.code, p("alice"), T);
    const updated = await joinRoom(room.code, p("alice"), T);
    expect(updated.players).toHaveLength(2);
  });
  test("re-join refreshes their library sample", async () => {
    const room = await createRoom(p("host"), {}, T);
    await joinRoom(room.code, p("alice"), T);
    const moreTracks = [
      ...T,
      { id: "2", uri: "spotify:track:2", name: "T2", artists: ["A2"], durationMs: 1, previewUrl: null },
    ];
    const updated = await joinRoom(room.code, p("alice"), moreTracks);
    expect(updated.libraryByPlayer.alice).toHaveLength(2);
  });
  test("rejects join after game starts", async () => {
    const room = await createRoom(p("host"), {}, T);
    room.status = "in-round";
    await expect(joinRoom(room.code, p("late"), T)).rejects.toThrow();
  });
  test("rejects unknown room", async () => {
    await expect(joinRoom("ZZZZ", p("nobody"), T)).rejects.toThrow(/not found/i);
  });
});

describe("leaveRoom", () => {
  test("removes the player", async () => {
    const room = await createRoom(p("host"), {}, T);
    await joinRoom(room.code, p("alice"), T);
    const updated = await leaveRoom(room.code, "alice");
    expect(updated?.players.map((pl) => pl.id)).toEqual(["host"]);
    expect(updated?.libraryByPlayer.alice).toBeUndefined();
  });
  test("transfers host when host leaves", async () => {
    const room = await createRoom(p("host"), {}, T);
    await joinRoom(room.code, p("alice"), T);
    const updated = await leaveRoom(room.code, "host");
    expect(updated?.hostId).toBe("alice");
    expect(updated?.players[0].isHost).toBe(true);
  });
  test("deletes room when last player leaves", async () => {
    const room = await createRoom(p("host"), {}, T);
    const updated = await leaveRoom(room.code, "host");
    expect(updated).toBeNull();
  });
  test("returns null for unknown room", async () => {
    const updated = await leaveRoom("ZZZZ", "anyone");
    expect(updated).toBeNull();
  });
});

describe("publicRoom redaction", () => {
  test("strips libraryByPlayer", async () => {
    const room = await createRoom(p("host"), {}, T);
    const pub = publicRoom(room, "host");
    // @ts-expect-error - intentionally checking that the field is absent
    expect(pub.libraryByPlayer).toBeUndefined();
  });
  test("hides currentTrack name during in-round", async () => {
    const room = await createRoom(p("host"), {}, T);
    room.songPool = [
      { id: "1", uri: "spotify:track:1", name: "Secret", artists: ["Artist"], durationMs: 1, previewUrl: null, ownerIds: ["host"] },
    ];
    room.rounds = [{ index: 0, trackId: "1", startedAt: Date.now(), endedAt: null, activePlayerId: null, guesses: [], winnerId: null }];
    room.status = "in-round";
    const pub = publicRoom(room, "host");
    expect(pub.currentTrack?.name).toBeNull();
    expect(pub.currentTrack?.artists).toBeNull();
    expect(pub.currentTrack?.uri).toBe("spotify:track:1");
  });
  test("reveals currentTrack name during round-result", async () => {
    const room = await createRoom(p("host"), {}, T);
    room.songPool = [
      { id: "1", uri: "spotify:track:1", name: "Secret", artists: ["Artist"], durationMs: 1, previewUrl: null, ownerIds: ["host"] },
    ];
    room.rounds = [{ index: 0, trackId: "1", startedAt: Date.now(), endedAt: Date.now(), activePlayerId: null, guesses: [], winnerId: null }];
    room.status = "round-result";
    const pub = publicRoom(room, "host");
    expect(pub.currentTrack?.name).toBe("Secret");
    expect(pub.currentTrack?.artists).toEqual(["Artist"]);
  });
  test("includes ownerNames mapped from ids", async () => {
    const room = await createRoom(p("host"), {}, T);
    await joinRoom(room.code, p("alice"), T);
    room.songPool = [
      { id: "1", uri: "u", name: "Track", artists: ["A"], durationMs: 1, previewUrl: null, ownerIds: ["host", "alice"] },
    ];
    room.rounds = [{ index: 0, trackId: "1", startedAt: Date.now(), endedAt: null, activePlayerId: null, guesses: [], winnerId: null }];
    room.status = "in-round";
    const pub = publicRoom(room, "host");
    expect(pub.currentTrack?.ownerNames.sort()).toEqual(["alice", "host"]);
  });
  test("songPoolSize reports count without leaking the pool", async () => {
    const room = await createRoom(p("host"), {}, T);
    room.songPool = Array(7).fill(null).map((_, i) => ({
      id: `${i}`, uri: `u${i}`, name: `T${i}`, artists: ["A"], durationMs: 1, previewUrl: null, ownerIds: ["host"],
    }));
    const pub = publicRoom(room, "host");
    expect(pub.songPoolSize).toBe(7);
    // @ts-expect-error - intentionally checking that the field is absent
    expect(pub.songPool).toBeUndefined();
  });
});
