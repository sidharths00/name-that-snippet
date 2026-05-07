import { describe, expect, test } from "vitest";
import { getStore } from "./store";
import type { Room } from "./types";

function makeRoom(code: string): Room {
  return {
    code,
    hostId: "host",
    status: "lobby",
    settings: {
      gameMode: "race",
      playbackMode: "host-only",
      rounds: 5,
      snippetSeconds: 20,
      uniqueTrackRatio: 0.2,
    },
    players: [],
    songPool: [],
    rounds: [],
    libraryByPlayer: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("memory store", () => {
  test("set + get roundtrip", async () => {
    const store = getStore();
    const room = makeRoom("ABCD");
    await store.setRoom(room);
    const fetched = await store.getRoom("ABCD");
    expect(fetched?.code).toBe("ABCD");
    expect(fetched?.hostId).toBe("host");
  });

  test("get unknown returns null", async () => {
    const store = getStore();
    const fetched = await store.getRoom("ZZZZ");
    expect(fetched).toBeNull();
  });

  test("delete removes the room", async () => {
    const store = getStore();
    const room = makeRoom("EFGH");
    await store.setRoom(room);
    await store.deleteRoom("EFGH");
    expect(await store.getRoom("EFGH")).toBeNull();
  });

  test("publish notifies subscribers", async () => {
    const store = getStore();
    const events: string[] = [];
    const unsub = store.subscribe("PUBSUB", (ev) => events.push(ev.type));
    await store.publish("PUBSUB", { type: "ping", at: Date.now() });
    await store.publish("PUBSUB", { type: "room-updated", at: Date.now() });
    expect(events).toEqual(["ping", "room-updated"]);
    unsub();
  });

  test("unsubscribed listener stops receiving", async () => {
    const store = getStore();
    const events: string[] = [];
    const unsub = store.subscribe("UNSUB", (ev) => events.push(ev.type));
    unsub();
    await store.publish("UNSUB", { type: "ping", at: Date.now() });
    expect(events).toEqual([]);
  });

  test("publish to channel with no subscribers is a no-op", async () => {
    const store = getStore();
    await expect(
      store.publish("EMPTY", { type: "ping", at: Date.now() }),
    ).resolves.not.toThrow();
  });

  test("multiple subscribers all receive events", async () => {
    const store = getStore();
    const a: string[] = [];
    const b: string[] = [];
    const ua = store.subscribe("MULTI", (ev) => a.push(ev.type));
    const ub = store.subscribe("MULTI", (ev) => b.push(ev.type));
    await store.publish("MULTI", { type: "ping", at: Date.now() });
    expect(a).toEqual(["ping"]);
    expect(b).toEqual(["ping"]);
    ua();
    ub();
  });
});
