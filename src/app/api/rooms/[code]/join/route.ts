import { NextResponse } from "next/server";
import { joinRoom } from "@/lib/room";
import { requireSpotifySession } from "@/lib/session-token";
import { getUserLibrarySample } from "@/lib/spotify";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const result = await requireSpotifySession();
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "session-expired"
            ? "Your Spotify session expired. Sign in again."
            : "Sign in with Spotify first.",
        reason: result.reason,
      },
      { status: 401 },
    );
  }
  const session = result.session;
  const { code } = await params;

  let library;
  try {
    library = await getUserLibrarySample(session.accessToken);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't load your library" },
      { status: 502 },
    );
  }

  try {
    const room = await joinRoom(
      code.toUpperCase(),
      {
        id: session.userId,
        name: session.name,
        image: session.image,
        isHost: false,
        isPremium: session.isPremium,
        score: 0,
        joinedAt: Date.now(),
      },
      library,
    );
    return NextResponse.json({ code: room.code });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't join" },
      { status: 400 },
    );
  }
}
