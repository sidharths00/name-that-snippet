import { describe, expect, test } from "vitest";
import { generateRoomCode } from "./code";

describe("generateRoomCode", () => {
  test("default length is 4", () => {
    expect(generateRoomCode().length).toBe(4);
  });
  test("custom length", () => {
    expect(generateRoomCode(6).length).toBe(6);
  });
  test("only contains safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode(8);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
      // No confusing chars
      expect(code).not.toMatch(/[IO01]/);
    }
  });
  test("randomness — 50 codes have at least 40 unique", () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) set.add(generateRoomCode(4));
    expect(set.size).toBeGreaterThanOrEqual(40);
  });
});
