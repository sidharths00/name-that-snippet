import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStore } from "@/lib/store";
import { publicRoom } from "@/lib/room";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  const room = await getStore().getRoom(code.toUpperCase());
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json({ room: publicRoom(room, session?.user?.id ?? null) });
}
