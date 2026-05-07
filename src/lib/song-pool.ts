import type { Player, Track } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildSongPool(
  players: Player[],
  libraryByPlayer: Record<string, Track[]>,
  rounds: number,
  uniqueRatio: number,
  excludeTrackIds: string[] = [],
): Track[] {
  const exclude = new Set(excludeTrackIds);
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

  let all = Array.from(merged.values());
  // If excluding used tracks left us short, relax the exclusion. Better to
  // allow some repeats than to deliver fewer rounds than the host configured.
  if (all.length < rounds && exclude.size > 0) {
    const fallbackMerged = new Map<string, Track>();
    for (const p of players) {
      const lib = libraryByPlayer[p.id] ?? [];
      for (const t of lib) {
        const existing = fallbackMerged.get(t.id);
        if (existing) {
          if (!existing.ownerIds.includes(p.id)) existing.ownerIds.push(p.id);
        } else {
          fallbackMerged.set(t.id, { ...t, ownerIds: [p.id] });
        }
      }
    }
    all = Array.from(fallbackMerged.values());
  }
  const common = all.filter((t) => t.ownerIds.length >= 2);
  const unique = all.filter((t) => t.ownerIds.length === 1);

  const targetUnique = Math.min(unique.length, Math.round(rounds * uniqueRatio));
  const targetCommon = Math.max(0, rounds - targetUnique);

  const picks: Track[] = [
    ...shuffle(common).slice(0, targetCommon),
    ...shuffle(unique).slice(0, targetUnique),
  ];

  // If we still don't have enough (small libraries / no overlap), pad from
  // whatever's left.
  if (picks.length < rounds) {
    const used = new Set(picks.map((p) => p.id));
    const leftover = shuffle(all.filter((t) => !used.has(t.id))).slice(
      0,
      rounds - picks.length,
    );
    picks.push(...leftover);
  }

  return shuffle(picks).slice(0, rounds);
}
