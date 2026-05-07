import { auth } from "@/auth";
import { getStore } from "@/lib/store";
import { publicRoom } from "@/lib/room";
import type { PublicGameEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  const upper = code.toUpperCase();
  const store = getStore();
  const room = await store.getRoom(upper);
  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  const viewerId = session?.user?.id ?? null;
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(payload: PublicGameEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      }

      let lastUpdatedAt = room.updatedAt;
      send({ type: "room-updated", room: publicRoom(room, viewerId), at: Date.now() });

      // In-process pub/sub: instant updates when the change happens on the
      // same Vercel function instance.
      const unsubscribe = store.subscribe(upper, (ev) => {
        try {
          if (ev.room) lastUpdatedAt = ev.room.updatedAt;
          const payload: PublicGameEvent = ev.room
            ? { ...ev, room: publicRoom(ev.room, viewerId) }
            : { ...ev, room: undefined };
          send(payload);
        } catch {
          // stream closed
        }
      });

      // Cross-instance fallback: poll Redis every 2s for changes. Vercel
      // routes requests to whichever warm instance is available, so the host
      // and joiner aren't guaranteed to share an in-process bus.
      const pollInterval = setInterval(async () => {
        try {
          const fresh = await store.getRoom(upper);
          if (fresh && fresh.updatedAt > lastUpdatedAt) {
            lastUpdatedAt = fresh.updatedAt;
            send({
              type: "room-updated",
              room: publicRoom(fresh, viewerId),
              at: Date.now(),
            });
          } else if (!fresh) {
            // Room got deleted — close the stream so the client can react.
            cleanup?.();
          }
        } catch {
          // ignore — try again next tick
        }
      }, 2000);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      cleanup = () => {
        clearInterval(heartbeat);
        clearInterval(pollInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", () => cleanup?.());
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
