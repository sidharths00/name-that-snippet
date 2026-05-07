import { beforeEach, describe, expect, test } from "vitest";
import { createRoom, joinRoom } from "./room";
import { startGame, startNextRound, submitGuess } from "./game";
import type { Player } from "./types";
import type { SimpleTrack } from "./spotify";

function p(id: string, isHost = false): Player {
  return {
    id,
    name: id,
    image: null,
    isHost,
    isPremium: true,
    score: 0,
    joinedAt: 0,
  };
}

function t(id: string, name: string, artists: string[]): SimpleTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    name,
    artists,
    durationMs: 200_000,
    previewUrl: null,
  };
}

const TRACKS: SimpleTrack[] = [
  t("1", "Bohemian Rhapsody", ["Queen"]),
  t("2", "Mr. Brightside", ["The Killers"]),
  t("3", "Stay (with Justin Bieber)", ["The Kid LAROI", "Justin Bieber"]),
  t("4", "Don't Stop Believin'", ["Journey"]),
  t("5", "Old Town Road", ["Lil Nas X"]),
];

beforeEach(() => {
  // Reset in-memory store between tests
  // (the store is module-scoped, so we just create new room codes)
});

describe("game flow", () => {
  test("start → round → guess → score → next round", async () => {
    let room = await createRoom(p("host", true), { rounds: 3 }, TRACKS);
    room = await joinRoom(room.code, p("alice"), TRACKS);

    room = await startGame(room);
    expect(room.songPool.length).toBe(3);
    expect(room.players.every((pl) => pl.score === 0)).toBe(true);

    room = await startNextRound(room);
    expect(room.status).toBe("in-round");
    expect(room.rounds.length).toBe(1);

    const round = room.rounds[0];
    const track = room.songPool.find((tt) => tt.id === round.trackId)!;

    // Wrong guess: no score
    let result = await submitGuess(room, "alice", "totally wrong");
    expect(result.guess.points).toBe(0);

    // Correct title
    result = await submitGuess(room, "alice", track.name);
    expect(result.guess.titleHit).toBe(true);
    expect(result.guess.points).toBeGreaterThanOrEqual(1);

    // Correct artist completes the round in race mode
    result = await submitGuess(room, "alice", track.artists[0]);
    expect(result.guess.artistHit).toBe(true);
    expect(result.room.status).toBe("round-result");
    expect(result.room.rounds[0].winnerId).toBe("alice");
  });

  test("submit guess errors when no round in progress", async () => {
    const room = await createRoom(p("host", true), { rounds: 3 }, TRACKS);
    await expect(submitGuess(room, "host", "anything")).rejects.toThrow();
  });

  test("turn-based: only active player can guess", async () => {
    let room = await createRoom(p("host", true), { rounds: 3, gameMode: "turns" }, TRACKS);
    room = await joinRoom(room.code, p("alice"), TRACKS);
    room = await joinRoom(room.code, p("bob"), TRACKS);

    room = await startGame(room);
    room = await startNextRound(room);
    expect(room.rounds[0].activePlayerId).toBeTruthy();
    const active = room.rounds[0].activePlayerId!;
    const inactive = room.players.find((pl) => pl.id !== active)!.id;

    await expect(submitGuess(room, inactive, "anything")).rejects.toThrow(/turn/i);
  });

  test("speed bonus shrinks over time", async () => {
    let room = await createRoom(
      p("host", true),
      { rounds: 1, snippetSeconds: 20 },
      TRACKS,
    );
    room = await startGame(room);
    room = await startNextRound(room);
    const track = room.songPool[0];

    // Tweak round.startedAt to simulate elapsed time
    room.rounds[0].startedAt = Date.now() - 18_000; // 18s in
    const result = await submitGuess(room, "host", `${track.name} ${track.artists[0]}`);
    // Both fields hit on this guess → small or zero speed bonus
    expect(result.guess.points).toBeGreaterThanOrEqual(2);
    expect(result.guess.points).toBeLessThanOrEqual(3); // 2 base + at most 1 bonus
  });

  test("solo: single host can play through a full game", async () => {
    let room = await createRoom(p("solo", true), { rounds: 3 }, TRACKS);
    expect(room.players.length).toBe(1);
    room = await startGame(room);
    expect(room.songPool.length).toBe(3);

    for (let i = 0; i < 3; i++) {
      room = await startNextRound(room);
      expect(room.status).toBe("in-round");
      const track = room.songPool.find((tt) => tt.id === room.rounds[i].trackId)!;
      // Guess title and artist
      await submitGuess(room, "solo", track.name);
      const result = await submitGuess(room, "solo", track.artists[0]);
      room = result.room;
      expect(room.status).toBe("round-result");
    }

    room = await startNextRound(room); // advance past last round
    expect(room.status).toBe("finished");
    expect(room.players[0].score).toBeGreaterThan(0);
  });

  test("game finishes after configured rounds", async () => {
    let room = await createRoom(p("host", true), { rounds: 2 }, TRACKS);
    room = await startGame(room);
    room = await startNextRound(room);
    room = await startNextRound(room); // round 2
    expect(room.rounds.length).toBe(2);
    room = await startNextRound(room); // should finish
    expect(room.status).toBe("finished");
  });
});
