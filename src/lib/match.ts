// Fuzzy match guess vs. track title / artist. We're lenient — punctuation,
// casing, "feat." annotations, and parenthetical bits don't count. Single-
// character typos within a token are allowed via Levenshtein distance.

const STRIP_PARENS = /\([^)]*\)|\[[^\]]*\]/g;
const STRIP_FEAT = /\b(feat\.?|featuring|ft\.?|with|w\/)\b.*$/i;
const STRIP_DASH_SUFFIX = /\s+-\s+.*$/;
const STRIP_NOISE = /\b(remaster(ed)?|remix|deluxe|mono|stereo|acoustic|live|version|edit|extended|radio|original|bonus|track|single|album)\b/gi;
// Common English connectives. We filter these from both guess and target so
// shared filler words don't create false matches (e.g., "nine to five" vs.
// "25 or 6 to 4" — both contain "to" but neither is the same song).
const STOPWORDS = new Set([
  "the", "a", "an",
  "to", "of", "and", "or", "in", "on", "for", "at", "by", "is",
]);
const NON_ALNUM = /[^a-z0-9 ]+/g;
const MULTI_SPACE = /\s+/g;

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(STRIP_PARENS, " ")
    .replace(STRIP_FEAT, " ")
    .replace(STRIP_DASH_SUFFIX, " ")
    .replace(STRIP_NOISE, " ")
    .replace(/&/g, " and ")
    .replace(/[''`"]/g, "")
    .replace(NON_ALNUM, " ")
    .replace(MULTI_SPACE, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

// Classic Levenshtein distance. O(n*m) — we only call it on short tokens
// (<= ~12 chars), so the cost is negligible.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// Allow a small number of character mistakes scaled to token length:
//   <=3 chars: must match exactly
//   4-6 chars: 1 typo
//   7+ chars : 2 typos
function tokenSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length <= 3 || b.length <= 3) return false;
  const max = Math.min(a.length, b.length) >= 7 ? 2 : 1;
  return levenshtein(a, b) <= max;
}

// Token-set similarity: fraction of guess tokens that find a match in target.
function tokenCover(guess: string[], target: string[]): number {
  if (guess.length === 0) return 0;
  const targetSet = new Set(target);
  let hit = 0;
  for (const g of guess) {
    if (targetSet.has(g)) {
      hit += 1;
      continue;
    }
    let best = 0;
    for (const t of target) {
      // Substring match — both tokens must be >=3 chars to avoid "ay" matching
      // "stay" or "an" matching every artist whose name has "an" in it.
      if (g.length >= 3 && t.length >= 3 && (t.includes(g) || g.includes(t))) {
        best = Math.max(best, 0.85);
      } else if (tokenSimilar(g, t)) {
        best = Math.max(best, 0.85);
      }
    }
    hit += best;
  }
  return Math.min(1, hit / guess.length);
}

// All target tokens must be findable in the guess (or at least 80% of them
// for long titles).
function targetCovered(guess: string[], target: string[]): boolean {
  if (target.length === 0) return false;
  const guessSet = new Set(guess);
  let hit = 0;
  for (const t of target) {
    if (guessSet.has(t)) hit++;
    else if (
      guess.some(
        (g) =>
          (g.length >= 3 && t.length >= 3 && (t.includes(g) || g.includes(t))) ||
          tokenSimilar(g, t),
      )
    )
      hit++;
  }
  return hit / target.length >= 0.8;
}

// Pull out parenthetical content as candidate alt titles. Songs often have
// the actually-recognizable name in parens (e.g., "What If You Fly (Sweet
// Disposition)"). Skip parens that are obviously feat/with annotations.
const PAREN_CONTENT = /\(([^)]+)\)|\[([^\]]+)\]/g;
const FEAT_PARENS = /^\s*(feat\.?|featuring|ft\.?|with|w\/)\b/i;

function altTitles(target: string): string[] {
  const out: string[] = [];
  for (const m of target.matchAll(PAREN_CONTENT)) {
    const inner = (m[1] ?? m[2] ?? "").trim();
    if (inner && !FEAT_PARENS.test(inner)) out.push(inner);
  }
  return out;
}

function fullMatch(guess: string, target: string): boolean {
  const g = tokens(guess);
  if (g.length === 0) return false;
  // Try the main (parens-stripped) form first.
  const t = tokens(target);
  if (t.length > 0 && (tokenCover(g, t) >= 0.65 || targetCovered(g, t))) {
    return true;
  }
  // Then try each parenthetical as a candidate alt title.
  for (const alt of altTitles(target)) {
    const at = tokens(alt);
    if (at.length === 0) continue;
    if (tokenCover(g, at) >= 0.65 || targetCovered(g, at)) return true;
  }
  return false;
}

export interface JudgeResult {
  titleHit: boolean;
  artistHit: boolean;
}

export function judgeGuess(guess: string, title: string, artists: string[]): JudgeResult {
  if (!guess.trim()) return { titleHit: false, artistHit: false };
  const titleHit = fullMatch(guess, title);
  const artistHit = artists.some((a) => fullMatch(guess, a));
  return { titleHit, artistHit };
}
