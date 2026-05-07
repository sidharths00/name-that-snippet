// Fuzzy match guess vs. track title / artist. We're lenient — punctuation,
// casing, "feat." annotations, and parenthetical bits don't count.

const STRIP_PARENS = /\([^)]*\)|\[[^\]]*\]/g;
const STRIP_FEAT = /\b(feat\.?|featuring|ft\.?|with)\b.*$/i;
const STRIP_REMASTER = /\s*-\s*(remaster(ed)?|deluxe|mono|stereo|acoustic|live|version)\b.*$/i;
const NON_ALNUM = /[^a-z0-9 ]+/g;
const MULTI_SPACE = /\s+/g;

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(STRIP_PARENS, " ")
    .replace(STRIP_FEAT, " ")
    .replace(STRIP_REMASTER, " ")
    .replace(/&/g, " and ")
    // Strip apostrophes / smart quotes to nothing (don't → dont, not don t).
    .replace(/[''`"]/g, "")
    .replace(NON_ALNUM, " ")
    .replace(MULTI_SPACE, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

// Token-set similarity: 1.0 means every guess token appears in the target.
function tokenCover(guess: string, target: string): number {
  const g = tokens(guess);
  const t = new Set(tokens(target));
  if (g.length === 0) return 0;
  let hit = 0;
  for (const tok of g) {
    if (t.has(tok)) hit++;
    else {
      // partial substring match for short typos
      for (const tt of t) {
        if (tt.length > 3 && (tt.includes(tok) || tok.includes(tt))) {
          hit += 0.7;
          break;
        }
      }
    }
  }
  return Math.min(1, hit / g.length);
}

function fullMatch(guess: string, target: string): boolean {
  const g = normalize(guess);
  const t = normalize(target);
  if (!g || !t) return false;
  if (g === t) return true;
  // also accept if target's tokens are all present
  const tToks = tokens(t);
  const gSet = new Set(tokens(g));
  if (tToks.length > 0 && tToks.every((tok) => gSet.has(tok))) return true;
  return tokenCover(g, t) >= 0.8;
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
