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

  test("partial credit: title-only awards 1 point and round stays open", async () => {
    let room = await createRoom(p("host", true), { rounds: 1 }, TRACKS);
    room = await joinRoom(room.code, p("alice"), TRACKS);
    room = await startGame(room);
    room = await startNextRound(room);
    const track = room.songPool[0];
    const result = await submitGuess(room, "alice", track.name);
    expect(result.guess.titleHit).toBe(true);
    expect(result.guess.artistHit).toBe(false);
    expect(result.guess.points).toBe(1);
    expect(result.room.status).toBe("in-round");
  });

  test("guessing same field twice doesn't double-score", async () => {
    let room = await createRoom(p("host", true), { rounds: 1 }, TRACKS);
    room = await joinRoom(room.code, p("alice"), TRACKS);
    room = await startGame(room);
    room = await startNextRound(room);
    const track = room.songPool[0];
    await submitGuess(room, "alice", track.name);
    const before = room.players.find((pl) => pl.id === "alice")!.score;
    const result = await submitGuess(room, "alice", track.name);
    expect(result.guess.points).toBe(0);
    expect(result.room.players.find((pl) => pl.id === "alice")!.score).toBe(before);
  });

  test("race: only one player can win — second player's late guess gets 0 since round ended", async () => {
    let room = await createRoom(p("host", true), { rounds: 1 }, TRACKS);
    room = await joinRoom(room.code, p("alice"), TRACKS);
    room = await joinRoom(room.code, p("bob"), TRACKS);
    room = await startGame(room);
    room = await startNextRound(room);
    const track = room.songPool[0];
    await submitGuess(room, "alice", track.name);
    const result = await submitGuess(room, "alice", track.artists[0]);
    expect(result.room.status).toBe("round-result");
    expect(result.room.rounds[0].winnerId).toBe("alice");
    // Bob trying to guess after the round ended should fail
    await expect(submitGuess(result.room, "bob", track.name)).rejects.toThrow();
  });

  test("snippet length influences speed bonus", async () => {
    let room = await createRoom(p("host", true), { rounds: 1, snippetSeconds: 10 }, TRACKS);
    room = await startGame(room);
    room = await startNextRound(room);
    const track = room.songPool[0];
    // Simulate guessing right at the start (full bonus)
    room.rounds[0].startedAt = Date.now();
    const result = await submitGuess(room, "host", `${track.name} ${track.artists[0]}`);
    // 1 (title) + 1 (artist) + bonus (up to 2)
    expect(result.guess.points).toBeGreaterThanOrEqual(2);
  });

  test("speed mode: round stays open after first complete; everyone scores", async () => {
    let room = await createRoom(p("host", true), { rounds: 1, gameMode: "speed", snippetSeconds: 30 }, TRACKS);
    room = await joinRoom(room.code, p("alice"), TRACKS);
    room = await joinRoom(room.code, p("bob"), TRACKS);
    room = await startGame(room);
    room = await startNextRound(room);
    const track = room.songPool[0];

    // Alice gets both early — gets points + speed bonus, but round doesn't end
    room.rounds[0].startedAt = Date.now();
    let r = await submitGuess(room, "alice", track.name);
    r = await submitGuess(r.room, "alice", track.artists[0]);
    expect(r.room.status).toBe("in-round");
    const aliceScore = r.room.players.find((pl) => pl.id === "alice")!.score;
    expect(aliceScore).toBeGreaterThan(2); // 1+1 base + bonus

    // Bob also guesses — should still be allowed and scored
    r = await submitGuess(r.room, "bob", track.name);
    expect(r.guess.titleHit).toBe(true);
    expect(r.guess.points).toBeGreaterThanOrEqual(1);
    expect(r.room.players.find((pl) => pl.id === "bob")!.score).toBeGreaterThan(0);
  });

  test("speed mode: per-field speed bonus makes early hits worth more than late", async () => {
    let early = await createRoom(p("host", true), { rounds: 1, gameMode: "speed", snippetSeconds: 30 }, TRACKS);
    early = await startGame(early);
    early = await startNextRound(early);
    const track = early.songPool[0];
    early.rounds[0].startedAt = Date.now();
    const earlyR = await submitGuess(early, "host", track.name);

    let late = await createRoom(p("host", true), { rounds: 1, gameMode: "speed", snippetSeconds: 30 }, TRACKS);
    late = await startGame(late);
    late = await startNextRound(late);
    const lateTrack = late.songPool[0];
    late.rounds[0].startedAt = Date.now() - 28_000; // near end
    const lateR = await submitGuess(late, "host", lateTrack.name);

    expect(earlyR.guess.points).toBeGreaterThan(lateR.guess.points);
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
