import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStore } from "@/lib/store";
import { startGame, startNextRound } from "@/lib/game";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in" }, { status: 401 });
  }
  const { code } = await params;
  const room = await getStore().getRoom(code.toUpperCase());
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.hostId !== session.user.id) {
    return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
  }

  try {
    await startGame(room);
    await startNextRound(room);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't start game" },
      { status: 400 },
    );
  }
}
