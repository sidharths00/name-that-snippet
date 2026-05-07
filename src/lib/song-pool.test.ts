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

  test("respects uniqueRatio", () => {
    const a = player("A");
    const b = player("B");
    const lib = {
      A: Array.from({ length: 20 }, (_, i) => track(`s${i}`, "A")),
      B: Array.from({ length: 20 }, (_, i) => track(`s${i}`, "B")),
    };
    // Add unique tracks
    lib.A.push(...Array.from({ length: 10 }, (_, i) => track(`u${i}`, "A")));
    lib.B.push(...Array.from({ length: 10 }, (_, i) => track(`v${i}`, "B")));

    const pool = buildSongPool([a, b], lib, 10, 0.2);
    expect(pool.length).toBe(10);
    const common = pool.filter((t) => t.ownerIds.length === 2);
    const unique = pool.filter((t) => t.ownerIds.length === 1);
    expect(unique.length).toBe(2); // 10 * 0.2
    expect(common.length).toBe(8);
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
});
