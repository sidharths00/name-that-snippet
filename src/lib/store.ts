import { Redis } from "@upstash/redis";
import type { Room, GameEvent } from "./types";

type Listener = (event: GameEvent) => void;

interface Store {
  getRoom(code: string): Promise<Room | null>;
  setRoom(room: Room): Promise<void>;
  deleteRoom(code: string): Promise<void>;
  publish(code: string, event: GameEvent): Promise<void>;
  subscribe(code: string, listener: Listener): () => void;
}

const ROOM_TTL_SECONDS = 60 * 60 * 6;

class MemoryStore implements Store {
  private rooms = new Map<string, Room>();
  private listeners = new Map<string, Set<Listener>>();

  async getRoom(code: string) {
    return this.rooms.get(code) ?? null;
  }
  async setRoom(room: Room) {
    this.rooms.set(room.code, room);
  }
  async deleteRoom(code: string) {
    this.rooms.delete(code);
    this.listeners.delete(code);
  }
  async publish(code: string, event: GameEvent) {
    const set = this.listeners.get(code);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(event);
      } catch {
        // ignore broken listener
      }
    }
  }
  subscribe(code: string, listener: Listener) {
    let set = this.listeners.get(code);
    if (!set) {
      set = new Set();
      this.listeners.set(code, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }
}

class RedisStore implements Store {
  private memoryFanout = new MemoryStore();
  constructor(private redis: Redis) {}

  private key(code: string) {
    return `room:${code.toUpperCase()}`;
  }

  async getRoom(code: string) {
    const data = await this.redis.get<Room>(this.key(code));
    return data ?? null;
  }
  async setRoom(room: Room) {
    await this.redis.set(this.key(room.code), room, { ex: ROOM_TTL_SECONDS });
  }
  async deleteRoom(code: string) {
    await this.redis.del(this.key(code));
  }
  async publish(code: string, event: GameEvent) {
    // Single-region fanout via in-process listeners. Cross-instance fanout
    // would need Redis pub/sub or a websocket service; fine for v1.
    await this.memoryFanout.publish(code, event);
  }
  subscribe(code: string, listener: Listener) {
    return this.memoryFanout.subscribe(code, listener);
  }
}

let _store: Store | null = null;

export function getStore(): Store {
  if (_store) return _store;
  // Vercel Marketplace ships Upstash with KV_REST_API_* names; standalone
  // Upstash deployments use UPSTASH_REDIS_REST_*. Accept either.
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    _store = new RedisStore(new Redis({ url, token }));
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[store] Upstash Redis not configured — using in-memory store. Rooms will not survive a redeploy.",
      );
    }
    _store = new MemoryStore();
  }
  return _store;
}
