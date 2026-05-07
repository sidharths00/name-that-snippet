import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { leaveRoom } from "@/lib/room";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { code } = await params;
  await leaveRoom(code.toUpperCase(), session.user.id);
  return NextResponse.json({ ok: true });
}
