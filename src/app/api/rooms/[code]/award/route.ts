import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getStore } from "@/lib/store";
import { endRound } from "@/lib/game";
import type { RoundGuess } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  playerId: z.string(),
  titleHit: z.boolean().optional(),
  artistHit: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in" }, { status: 401 });
  }
  const { code } = await params;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const store = getStore();
  const room = await store.getRoom(code.toUpperCase());
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.hostId !== session.user.id) {
    return NextResponse.json({ error: "Host only" }, { status: 403 });
  }
  if (room.status !== "in-round") {
    return NextResponse.json({ error: "No round in progress" }, { status: 400 });
  }
  const round = room.rounds[room.rounds.length - 1];
  if (!round) return NextResponse.json({ error: "No round" }, { status: 400 });

  const player = room.players.find((p) => p.id === body.data.playerId);
  if (!player) return NextResponse.json({ error: "Unknown player" }, { status: 400 });

  const priorHits = round.guesses.filter((g) => g.playerId === player.id);
  const alreadyTitle = priorHits.some((g) => g.titleHit);
  const alreadyArtist = priorHits.some((g) => g.artistHit);

  const newTitle = !!body.data.titleHit && !alreadyTitle;
  const newArtist = !!body.data.artistHit && !alreadyArtist;
  const points = (newTitle ? 1 : 0) + (newArtist ? 1 : 0);
  player.score += points;

  const guess: RoundGuess = {
    playerId: player.id,
    guess: `[host-awarded] title=${body.data.titleHit ?? false} artist=${body.data.artistHit ?? false}`,
    at: Date.now(),
    titleHit: newTitle,
    artistHit: newArtist,
    points,
  };
  round.guesses.push(guess);

  // If both fields are now hit, auto-end the round so the host doesn't need
  // to reveal manually.
  const completes = (newTitle || alreadyTitle) && (newArtist || alreadyArtist);
  if (completes) {
    round.winnerId = player.id;
    await endRound(room);
  } else {
    room.updatedAt = Date.now();
    await store.setRoom(room);
    await store.publish(room.code, { type: "guess-submitted", room, at: Date.now() });
  }

  return NextResponse.json({ ok: true });
}
