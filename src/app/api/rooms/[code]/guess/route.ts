import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getStore } from "@/lib/store";
import { submitGuess } from "@/lib/game";

export const runtime = "nodejs";

const Body = z.object({ guess: z.string().min(1).max(200) });

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in" }, { status: 401 });
  }
  const { code } = await params;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Empty guess" }, { status: 400 });
  }
  const room = await getStore().getRoom(code.toUpperCase());
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  try {
    const result = await submitGuess(room, session.user.id, body.data.guess);
    return NextResponse.json({
      titleHit: result.guess.titleHit,
      artistHit: result.guess.artistHit,
      points: result.guess.points,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't submit" },
      { status: 400 },
    );
  }
}
