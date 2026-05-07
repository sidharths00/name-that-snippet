import { NextResponse } from "next/server";
import { requireSpotifySession } from "@/lib/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the calling user's Spotify access token. The Web Playback SDK calls
// this from the browser to keep its token fresh. Tokens are short-lived and
// only usable for the user themself, so exposing this to the user's own
// browser is fine.
export async function GET() {
  const session = await requireSpotifySession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json({ accessToken: session.accessToken });
}
