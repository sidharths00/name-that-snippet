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

  test("2 players with plenty of shared tracks: pool is 100% shared", () => {
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
    for (let trial = 0; trial < 10; trial++) {
      const pool = buildSongPool([a, b], lib, 10, 0);
      expect(pool.length).toBe(10);
      // Every track should be 2-owner (both have it)
      for (const t of pool) {
        expect(t.ownerIds.length).toBe(2);
      }
    }
  });

  test("2 players with few shared tracks: fills shared first then solos", () => {
    const a = player("A");
    const b = player("B");
    const lib = {
      A: [
        ...Array.from({ length: 3 }, (_, i) => track(`s${i}`, "A")),
        ...Array.from({ length: 10 }, (_, i) => track(`uA${i}`, "A")),
      ],
      B: [
        ...Array.from({ length: 3 }, (_, i) => track(`s${i}`, "B")),
        ...Array.from({ length: 10 }, (_, i) => track(`uB${i}`, "B")),
      ],
    };
    const pool = buildSongPool([a, b], lib, 10, 0);
    expect(pool.length).toBe(10);
    const shared = pool.filter((t) => t.ownerIds.length === 2);
    // All 3 shared tracks consumed first
    expect(shared.length).toBe(3);
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

  test("4 players with fully disjoint libraries: each player has at least 1 track", () => {
    // Each player has 8 solo tracks, no overlap. With the new
    // overlap-preferring algorithm, every player is still guaranteed at least
    // one of their own tracks via the fairness top-up step.
    const players = ["A", "B", "C", "D"].map((id) => player(id));
    const lib: Record<string, ReturnType<typeof track>[]> = {};
    for (const p of players) {
      lib[p.id] = Array.from({ length: 8 }, (_, i) => track(`${p.id}${i}`, p.id));
    }
    const pool = buildSongPool(players, lib, 12, 0);
    expect(pool.length).toBe(12);
    for (const p of players) {
      const owned = pool.filter((t) => t.ownerIds.includes(p.id));
      expect(owned.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("when full-intersection (all-N) tracks exist, they dominate the pool", () => {
    const a = player("A");
    const b = player("B");
    const c = player("C");
    // 10 tracks owned by all 3 players, 10 owned by only A+B, 10 owned by C alone
    const all3 = Array.from({ length: 10 }, (_, i) => `all${i}`);
    const ab = Array.from({ length: 10 }, (_, i) => `ab${i}`);
    const cOnly = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const lib = {
      A: [...all3.map((id) => track(id, "A")), ...ab.map((id) => track(id, "A"))],
      B: [...all3.map((id) => track(id, "B")), ...ab.map((id) => track(id, "B"))],
      C: [...all3.map((id) => track(id, "C")), ...cOnly.map((id) => track(id, "C"))],
    };
    let fullCount = 0;
    for (let trial = 0; trial < 30; trial++) {
      const pool = buildSongPool([a, b, c], lib, 10, 0);
      fullCount += pool.filter((t) => t.ownerIds.length === 3).length;
    }
    // Across 30 trials × 10 rounds = 300 picks. With 60% target, expect ~180
    // full-intersection picks. Allow generous floor for variance.
    expect(fullCount).toBeGreaterThan(150);
  });

  test("prefers higher-overlap tracks over solo tracks in a 4-player game", () => {
    const players = ["A", "B", "C", "D"].map((id) => player(id));
    const lib: Record<string, ReturnType<typeof track>[]> = { A: [], B: [], C: [], D: [] };
    // 5 tracks owned by all 4
    for (let i = 0; i < 5; i++) {
      for (const p of players) lib[p.id].push(track(`all${i}`, p.id));
    }
    // 5 tracks owned by 3 of 4 (everyone except D)
    for (let i = 0; i < 5; i++) {
      for (const id of ["A", "B", "C"]) lib[id].push(track(`abc${i}`, id));
    }
    // 5 solo tracks each
    for (const p of players) {
      for (let i = 0; i < 5; i++) lib[p.id].push(track(`${p.id}solo${i}`, p.id));
    }
    const pool = buildSongPool(players, lib, 10, 0);
    const counts = pool.reduce((acc, t) => {
      acc[t.ownerIds.length] = (acc[t.ownerIds.length] ?? 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    // Most of the pool should be 4-owner tracks
    expect((counts[4] ?? 0)).toBeGreaterThanOrEqual(5);
    // Solo tracks should be rare (only as fairness top-up if needed)
    expect((counts[1] ?? 0)).toBeLessThanOrEqual(2);
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
