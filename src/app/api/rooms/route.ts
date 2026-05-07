import { NextResponse } from "next/server";
import { z } from "zod";
import { createRoom } from "@/lib/room";
import { startGame, startNextRound } from "@/lib/game";
import { requireSpotifySession } from "@/lib/session-token";
import { getUserLibrarySample } from "@/lib/spotify";

export const runtime = "nodejs";

const Body = z.object({
  gameMode: z.enum(["race", "turns", "speed"]).optional(),
  playbackMode: z.enum(["host-only", "everyone"]).optional(),
  rounds: z.number().int().min(3).max(30).optional(),
  snippetSeconds: z.number().int().min(5).max(60).optional(),
  solo: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await requireSpotifySession();
  if (!session) {
    return NextResponse.json({ error: "Sign in with Spotify first" }, { status: 401 });
  }
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  let library;
  try {
    library = await getUserLibrarySample(session.accessToken);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't load your library" },
      { status: 502 },
    );
  }

  const room = await createRoom(
    {
      id: session.userId,
      name: session.name,
      image: session.image,
      isHost: true,
      isPremium: session.isPremium,
      score: 0,
      joinedAt: Date.now(),
    },
    body.data,
    library,
  );

  // Solo mode: skip the lobby and jump straight into round 1.
  if (body.data.solo) {
    try {
      await startGame(room);
      await startNextRound(room);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Couldn't start solo game" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ code: room.code, solo: body.data.solo === true });
}
