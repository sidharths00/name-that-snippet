import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStore } from "@/lib/store";
import { endRound, startNextRound } from "@/lib/game";

export const runtime = "nodejs";

// POST /api/rooms/[code]/round  → host advances to the next round
// POST /api/rooms/[code]/round?action=end → host ends the current round early
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in" }, { status: 401 });
  }
  const { code } = await params;
  const room = await getStore().getRoom(code.toUpperCase());
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.hostId !== session.user.id) {
    return NextResponse.json({ error: "Only the host can advance" }, { status: 403 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "end") {
      await endRound(room);
    } else {
      await startNextRound(room);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't advance" },
      { status: 400 },
    );
  }
}
