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
  _uniqueRatio: number, // legacy param, ignored — fairness algo replaces it
  excludeTrackIds: string[] = [],
): Track[] {
  let exclude = new Set(excludeTrackIds);
  let all = mergeOwnership(players, libraryByPlayer, exclude);

  // Fallback: if excluding leaves the merged set too small, drop the
  // exclusions so the game still has something to play.
  if (all.length < rounds && exclude.size > 0) {
    exclude = new Set();
    all = mergeOwnership(players, libraryByPlayer, exclude);
  }

  if (all.length === 0) return [];

  // Fairness pass: round-robin through players guaranteeing each one gets a
  // proportional slice of the pool. Within each player's allotment we prefer
  // tracks that overlap with other players (more recognizable for the room),
  // falling back to that player's solo tracks.
  const minPerPlayer = Math.max(1, Math.floor(rounds / Math.max(players.length, 1)));
  const picked = new Map<string, Track>();
  for (const p of players) {
    const mine = all.filter((t) => t.ownerIds.includes(p.id) && !picked.has(t.id));
    // Prefer commons (multi-owner) first — more interesting trivia.
    const ordered = [
      ...shuffle(mine.filter((t) => t.ownerIds.length >= 2)),
      ...shuffle(mine.filter((t) => t.ownerIds.length === 1)),
    ];
    let added = 0;
    for (const t of ordered) {
      if (added >= minPerPlayer) break;
      if (picked.has(t.id)) continue;
      picked.set(t.id, t);
      added++;
    }
  }

  // Fill remaining slots from whatever's left, preferring common tracks.
  if (picked.size < rounds) {
    const remaining = all.filter((t) => !picked.has(t.id));
    const ordered = [
      ...shuffle(remaining.filter((t) => t.ownerIds.length >= 2)),
      ...shuffle(remaining.filter((t) => t.ownerIds.length === 1)),
    ];
    for (const t of ordered) {
      if (picked.size >= rounds) break;
      picked.set(t.id, t);
    }
  }

  return shuffle(Array.from(picked.values())).slice(0, rounds);
}
