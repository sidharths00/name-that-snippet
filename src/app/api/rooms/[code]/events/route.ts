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

      send({ type: "room-updated", room: publicRoom(room, viewerId), at: Date.now() });

      const unsubscribe = store.subscribe(upper, (ev) => {
        try {
          const payload: PublicGameEvent = ev.room
            ? { ...ev, room: publicRoom(ev.room, viewerId) }
            : { ...ev, room: undefined };
          send(payload);
        } catch {
          // stream closed
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      cleanup = () => {
        clearInterval(heartbeat);
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
