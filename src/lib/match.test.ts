import { describe, expect, test } from "vitest";
import { judgeGuess, normalize } from "./match";

describe("normalize", () => {
  test("strips parentheticals", () => {
    expect(normalize("Bohemian Rhapsody (Remastered 2011)")).toBe("bohemian rhapsody");
  });
  test("strips feat", () => {
    expect(normalize("Stay (with Justin Bieber)")).toBe("stay");
    expect(normalize("Old Town Road feat. Billy Ray Cyrus")).toBe("old town road");
  });
  test("expands ampersand", () => {
    expect(normalize("Simon & Garfunkel")).toBe("simon and garfunkel");
  });
  test("removes punctuation", () => {
    expect(normalize("Don't Stop Believin'")).toBe("dont stop believin");
  });
  test("normalizes diacritics", () => {
    expect(normalize("Beyoncé")).toBe("beyonce");
  });
});

describe("judgeGuess: title hits", () => {
  test("exact title", () => {
    const r = judgeGuess("Mr. Brightside", "Mr. Brightside", ["The Killers"]);
    expect(r.titleHit).toBe(true);
    expect(r.artistHit).toBe(false);
  });
  test("case + punctuation insensitive", () => {
    const r = judgeGuess("mr brightside", "Mr. Brightside", ["The Killers"]);
    expect(r.titleHit).toBe(true);
  });
  test("ignores remaster suffix", () => {
    const r = judgeGuess("bohemian rhapsody", "Bohemian Rhapsody - Remastered 2011", ["Queen"]);
    expect(r.titleHit).toBe(true);
  });
  test("ignores feat", () => {
    const r = judgeGuess("stay", "Stay (with Justin Bieber)", ["The Kid LAROI", "Justin Bieber"]);
    expect(r.titleHit).toBe(true);
  });
  test("rejects wrong title", () => {
    const r = judgeGuess("hello darkness", "Mr. Brightside", ["The Killers"]);
    expect(r.titleHit).toBe(false);
  });
});

describe("judgeGuess: artist hits", () => {
  test("exact artist", () => {
    const r = judgeGuess("The Killers", "Mr. Brightside", ["The Killers"]);
    expect(r.artistHit).toBe(true);
  });
  test("partial artist match", () => {
    const r = judgeGuess("killers", "Mr. Brightside", ["The Killers"]);
    expect(r.artistHit).toBe(true);
  });
  test("matches secondary artist", () => {
    const r = judgeGuess("justin bieber", "Stay", ["The Kid LAROI", "Justin Bieber"]);
    expect(r.artistHit).toBe(true);
  });
  test("rejects wrong artist", () => {
    const r = judgeGuess("coldplay", "Mr. Brightside", ["The Killers"]);
    expect(r.artistHit).toBe(false);
  });
});

describe("judgeGuess: typo tolerance (Levenshtein)", () => {
  test("single-char typo on long title", () => {
    const r = judgeGuess("bohemain rhapsody", "Bohemian Rhapsody", ["Queen"]);
    expect(r.titleHit).toBe(true);
  });
  test("single-char typo on artist", () => {
    const r = judgeGuess("queeen", "Bohemian Rhapsody", ["Queen"]);
    expect(r.artistHit).toBe(true);
  });
  test("two typos on a long token (7+ chars)", () => {
    const r = judgeGuess("rhapsodi", "Bohemian Rhapsody", ["Queen"]);
    expect(r.titleHit).toBe(true);
  });
  test("typo on short word stays strict", () => {
    // "soy" vs "you" — too short for fuzzy, should fail
    const r = judgeGuess("ay", "Stay", ["The Killers"]);
    expect(r.titleHit).toBe(false);
  });
});

describe("judgeGuess: stopwords", () => {
  test("'the killers' matches 'killers'", () => {
    const r = judgeGuess("killers", "Mr. Brightside", ["The Killers"]);
    expect(r.artistHit).toBe(true);
  });
  test("'the' alone shouldn't match an artist whose only differentiator is The", () => {
    const r = judgeGuess("the", "Mr. Brightside", ["The Killers"]);
    expect(r.artistHit).toBe(false);
  });
});

describe("judgeGuess: parenthetical alt titles", () => {
  test("matches the parenthetical when it's the recognizable name", () => {
    const r = judgeGuess(
      "sweet disposition",
      "What If You Fly (Sweet Disposition)",
      ["Some Artist"],
    );
    expect(r.titleHit).toBe(true);
  });
  test("still matches the main title", () => {
    const r = judgeGuess(
      "what if you fly",
      "What If You Fly (Sweet Disposition)",
      ["Some Artist"],
    );
    expect(r.titleHit).toBe(true);
  });
  test("doesn't accept feat-style parens as a title", () => {
    // "with justin bieber" inside parens shouldn't count as a title hit
    const r = judgeGuess(
      "with justin bieber",
      "Stay (with Justin Bieber)",
      ["The Kid LAROI", "Justin Bieber"],
    );
    expect(r.titleHit).toBe(false);
  });
});

describe("judgeGuess: dash suffix stripping", () => {
  test("strips ' - 2011 Mix' style suffix", () => {
    const r = judgeGuess("bohemian rhapsody", "Bohemian Rhapsody - 2011 Mix", ["Queen"]);
    expect(r.titleHit).toBe(true);
  });
});

describe("judgeGuess: false-positive guards", () => {
  test("'nine to five' does NOT match '25 or 6 to 4'", () => {
    const r = judgeGuess(
      "nine to five",
      "25 or 6 to 4 - 2002 Remaster",
      ["Chicago"],
    );
    expect(r.titleHit).toBe(false);
    expect(r.artistHit).toBe(false);
  });
  test("'in the' alone shouldn't match anything", () => {
    const r = judgeGuess("in the", "In the End", ["Linkin Park"]);
    expect(r.titleHit).toBe(false);
  });
  test("but 'end' alone DOES match 'In the End' (load-bearing word)", () => {
    const r = judgeGuess("end", "In the End", ["Linkin Park"]);
    expect(r.titleHit).toBe(true);
  });
  test("real-world: '9 to 5' matches '9 to 5'", () => {
    const r = judgeGuess("9 to 5", "9 to 5", ["Dolly Parton"]);
    expect(r.titleHit).toBe(true);
  });
  test("'just the two of us' matches itself", () => {
    const r = judgeGuess("just the two of us", "Just the Two of Us", ["Bill Withers"]);
    expect(r.titleHit).toBe(true);
  });
});

describe("judgeGuess: edge cases", () => {
  test("empty guess", () => {
    const r = judgeGuess("", "Mr. Brightside", ["The Killers"]);
    expect(r).toEqual({ titleHit: false, artistHit: false });
  });
  test("whitespace only", () => {
    const r = judgeGuess("   ", "Mr. Brightside", ["The Killers"]);
    expect(r.titleHit).toBe(false);
    expect(r.artistHit).toBe(false);
  });
  test("guess containing both title and artist hits both", () => {
    const r = judgeGuess(
      "mr brightside the killers",
      "Mr. Brightside",
      ["The Killers"],
    );
    expect(r.titleHit).toBe(true);
    expect(r.artistHit).toBe(true);
  });
});
