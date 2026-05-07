import { describe, expect, test } from "vitest";
import { buildSongPool } from "./song-pool";
import type { Player, Track } from "./types";

function player(id: string): Player {
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

function track(id: string, ownerId: string): Track {
  return {
    id,
    uri: `spotify:track:${id}`,
    name: id,
    artists: ["Some Artist"],
    durationMs: 200000,
    previewUrl: null,
    ownerIds: [ownerId],
  };
}

describe("buildSongPool", () => {
  test("prefers tracks owned by multiple players", () => {
    const a = player("A");
    const b = player("B");
    const lib = {
      A: [
        track("shared1", "A"),
        track("shared2", "A"),
        track("shared3", "A"),
        track("shared4", "A"),
        track("uniqA1", "A"),
        track("uniqA2", "A"),
      ],
      B: [
        track("shared1", "B"),
        track("shared2", "B"),
        track("shared3", "B"),
        track("shared4", "B"),
        track("uniqB1", "B"),
        track("uniqB2", "B"),
      ],
    };
    const pool = buildSongPool([a, b], lib, 4, 0);
    // With uniqueRatio 0 and enough common tracks, every pick is common.
    expect(pool.length).toBe(4);
    for (const t of pool) {
      expect(t.ownerIds.length).toBe(2);
    }
  });

  test("pads with unique tracks when there aren't enough common", () => {
    const a = player("A");
    const b = player("B");
    const lib = {
      A: [track("shared", "A"), track("uA", "A"), track("uA2", "A")],
      B: [track("shared", "B"), track("uB", "B"), track("uB2", "B")],
    };
    const pool = buildSongPool([a, b], lib, 4, 0);
    // 1 common available + pad with unique to reach 4
    expect(pool.length).toBe(4);
    expect(pool.filter((t) => t.ownerIds.length === 2).length).toBe(1);
  });

  test("prefers common (multi-owner) tracks when available", () => {
    const a = player("A");
    const b = player("B");
    const lib = {
      A: [
        ...Array.from({ length: 20 }, (_, i) => track(`s${i}`, "A")),
        ...Array.from({ length: 10 }, (_, i) => track(`uA${i}`, "A")),
      ],
      B: [
        ...Array.from({ length: 20 }, (_, i) => track(`s${i}`, "B")),
        ...Array.from({ length: 10 }, (_, i) => track(`uB${i}`, "B")),
      ],
    };
    const pool = buildSongPool([a, b], lib, 10, 0);
    expect(pool.length).toBe(10);
    const common = pool.filter((t) => t.ownerIds.length === 2);
    // With 20 common tracks available, the pool should lean heavily common.
    expect(common.length).toBeGreaterThanOrEqual(8);
  });

  test("merges ownerIds across players", () => {
    const a = player("A");
    const b = player("B");
    const c = player("C");
    const lib = {
      A: [track("shared", "A")],
      B: [track("shared", "B")],
      C: [track("shared", "C")],
    };
    const pool = buildSongPool([a, b, c], lib, 1, 0);
    expect(pool[0].ownerIds.sort()).toEqual(["A", "B", "C"]);
  });

  test("pads with leftover tracks if pool too small", () => {
    const a = player("A");
    const b = player("B");
    const lib = {
      A: [track("shared", "A"), track("u1", "A")],
      B: [track("shared", "B"), track("u2", "B")],
    };
    const pool = buildSongPool([a, b], lib, 3, 0); // need 3, only 1 common
    expect(pool.length).toBe(3);
  });

  test("empty libraries → empty pool", () => {
    const pool = buildSongPool([player("A")], { A: [] }, 5, 0);
    expect(pool).toEqual([]);
  });

  test("single player → all tracks marked as theirs", () => {
    const a = player("A");
    const lib = { A: [track("t1", "A"), track("t2", "A")] };
    const pool = buildSongPool([a], lib, 5, 0);
    expect(pool.length).toBe(2);
    for (const t of pool) {
      expect(t.ownerIds).toEqual(["A"]);
    }
  });

  test("excludeTrackIds removes tracks from the pool", () => {
    const a = player("A");
    const lib = {
      A: [
        track("t1", "A"),
        track("t2", "A"),
        track("t3", "A"),
        track("t4", "A"),
        track("t5", "A"),
      ],
    };
    const pool = buildSongPool([a], lib, 3, 0, ["t1", "t2"]);
    const ids = pool.map((t) => t.id);
    expect(ids).not.toContain("t1");
    expect(ids).not.toContain("t2");
    expect(pool.length).toBe(3);
  });

  test("falls back to allowing repeats when exclusion would leave too few tracks", () => {
    const a = player("A");
    const lib = {
      A: [track("t1", "A"), track("t2", "A"), track("t3", "A")],
    };
    // Exclude all 3 — pool would be empty without fallback
    const pool = buildSongPool([a], lib, 3, 0, ["t1", "t2", "t3"]);
    // Falls back to full library
    expect(pool.length).toBe(3);
  });

  test("3 players, one with zero overlap: every player is represented", () => {
    const a = player("A");
    const b = player("B");
    const c = player("C");
    const lib = {
      // A and B share 5 tracks. C has 5 totally separate tracks.
      A: [
        track("s1", "A"),
        track("s2", "A"),
        track("s3", "A"),
        track("s4", "A"),
        track("s5", "A"),
      ],
      B: [
        track("s1", "B"),
        track("s2", "B"),
        track("s3", "B"),
        track("s4", "B"),
        track("s5", "B"),
      ],
      C: [
        track("c1", "C"),
        track("c2", "C"),
        track("c3", "C"),
        track("c4", "C"),
        track("c5", "C"),
      ],
    };
    // Repeat several times — fairness shouldn't depend on luck.
    for (let trial = 0; trial < 20; trial++) {
      const pool = buildSongPool([a, b, c], lib, 9, 0);
      expect(pool.length).toBe(9);
      const cTracks = pool.filter((t) => t.ownerIds.includes("C"));
      // Min per player = floor(9/3) = 3 — C must always have at least 3.
      expect(cTracks.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("4 players: each gets at least floor(rounds/players) tracks", () => {
    const players = ["A", "B", "C", "D"].map((id) => player(id));
    const lib: Record<string, ReturnType<typeof track>[]> = {};
    for (const p of players) {
      lib[p.id] = Array.from({ length: 8 }, (_, i) => track(`${p.id}${i}`, p.id));
    }
    const pool = buildSongPool(players, lib, 12, 0);
    expect(pool.length).toBe(12);
    for (const p of players) {
      const owned = pool.filter((t) => t.ownerIds.includes(p.id));
      expect(owned.length).toBeGreaterThanOrEqual(3); // floor(12/4)
    }
  });

  test("if a player's library is empty, others fill in", () => {
    const a = player("A");
    const b = player("B");
    const lib = {
      A: Array.from({ length: 10 }, (_, i) => track(`a${i}`, "A")),
      B: [], // empty library (e.g., new Spotify account)
    };
    const pool = buildSongPool([a, b], lib, 5, 0);
    expect(pool.length).toBe(5);
    // All from A
    for (const t of pool) {
      expect(t.ownerIds).toContain("A");
    }
  });
});
