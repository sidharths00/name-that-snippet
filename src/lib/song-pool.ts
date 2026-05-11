import type { Player, Track } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function mergeOwnership(
  players: Player[],
  libraryByPlayer: Record<string, Track[]>,
  exclude: Set<string>,
): Track[] {
  const merged = new Map<string, Track>();
  for (const p of players) {
    const lib = libraryByPlayer[p.id] ?? [];
    for (const t of lib) {
      if (exclude.has(t.id)) continue;
      const existing = merged.get(t.id);
      if (existing) {
        if (!existing.ownerIds.includes(p.id)) existing.ownerIds.push(p.id);
      } else {
        merged.set(t.id, { ...t, ownerIds: [p.id] });
      }
    }
  }
  return Array.from(merged.values());
}

export function buildSongPool(
  players: Player[],
  libraryByPlayer: Record<string, Track[]>,
  rounds: number,
  _uniqueRatio: number, // legacy param, kept for back-compat in tests
  excludeTrackIds: string[] = [],
): Track[] {
  let exclude = new Set(excludeTrackIds);
  let all = mergeOwnership(players, libraryByPlayer, exclude);

  // Drop the exclusion list if it would leave the pool starved.
  if (all.length < rounds && exclude.size > 0) {
    exclude = new Set();
    all = mergeOwnership(players, libraryByPlayer, exclude);
  }

  if (all.length === 0) return [];

  const n = players.length;
  const picked = new Map<string, Track>();

  // Bucket tracks by ownership count (n = everyone, 1 = solo-owned).
  const buckets = new Map<number, Track[]>();
  for (const t of all) {
    const c = t.ownerIds.length;
    if (!buckets.has(c)) buckets.set(c, []);
    buckets.get(c)!.push(t);
  }

  // Step 1: Fill from the highest-overlap tier downward, taking everything
  // from each tier before descending. The pool ends up as "shared as possible".
  // For 2 players this means all shared tracks fill the pool first; solo
  // tracks only appear if there aren't enough shared songs.
  for (let count = n; count >= 2; count--) {
    if (picked.size >= rounds) break;
    const tier = shuffle(buckets.get(count) ?? []);
    for (const t of tier) {
      if (picked.size >= rounds) break;
      if (!picked.has(t.id)) picked.set(t.id, t);
    }
  }

  // Step 3: Fairness pass. Ensure each player has at least one track from
  // their library represented (in case overlap-heavy picks skipped them).
  const minPerPlayer = n >= 2 ? 1 : Math.floor(rounds / n);
  for (const p of players) {
    const owned = Array.from(picked.values()).filter((t) => t.ownerIds.includes(p.id));
    if (owned.length >= minPerPlayer) continue;
    const candidates = all
      .filter((t) => t.ownerIds.includes(p.id) && !picked.has(t.id))
      // Within the candidates, still prefer higher overlap.
      .sort((a, b) => b.ownerIds.length - a.ownerIds.length);
    for (let i = 0; i < minPerPlayer - owned.length && i < candidates.length; i++) {
      picked.set(candidates[i].id, candidates[i]);
    }
  }

  // Step 4: Fill any remaining slots from whatever's left (highest overlap
  // first, then random).
  if (picked.size < rounds) {
    const remaining = all
      .filter((t) => !picked.has(t.id))
      .sort((a, b) => b.ownerIds.length - a.ownerIds.length);
    for (const t of remaining) {
      if (picked.size >= rounds) break;
      picked.set(t.id, t);
    }
  }

  return shuffle(Array.from(picked.values())).slice(0, rounds);
}
