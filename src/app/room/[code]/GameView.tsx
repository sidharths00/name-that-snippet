"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayback } from "@/components/usePlayback";
import type { PublicRoom } from "@/lib/types";
import type { Viewer } from "./RoomClient";

const DEFAULT_START_OFFSET_MS = 30_000;

export function GameView({
  room,
  viewer,
  isHost,
}: {
  room: PublicRoom;
  viewer: Viewer;
  isHost: boolean;
}) {
  const round = room.rounds[room.rounds.length - 1];
  const inRound = room.status === "in-round";
  const inResult = room.status === "round-result";
  const track = room.currentTrack;

  // Decide if THIS device should produce audio.
  const shouldPlay =
    (room.settings.playbackMode === "host-only" && isHost) ||
    room.settings.playbackMode === "everyone";

  const playback = usePlayback({
    enabled: shouldPlay && viewer.isPremium,
    name: `Name That Snippet — ${viewer.name}`,
  });

  // Trigger play when a new round arrives.
  const playedTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!shouldPlay || !track || !inRound) return;
    if (playback.status !== "ready") return;
    if (playedTrackIdRef.current === track.id) return;
    playedTrackIdRef.current = track.id;
    playback.play(track.uri, DEFAULT_START_OFFSET_MS).catch((err) => {
      console.error("[playback] play failed", err);
    });
  }, [shouldPlay, track, inRound, playback]);

  // Pause + reset when round ends.
  useEffect(() => {
    if (inResult && shouldPlay) {
      playback.pause().catch(() => {});
    }
    if (room.status === "in-round" && !inRound) {
      playedTrackIdRef.current = null;
    }
  }, [inResult, inRound, shouldPlay, playback, room.status]);

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-10 pt-2 sm:px-10">
      <RoundHeader room={room} />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {inRound && (
            <NowPlaying
              durationMs={room.settings.snippetSeconds * 1000}
              startedAt={round?.startedAt ?? null}
              shouldPlay={shouldPlay}
              isPremium={viewer.isPremium}
              playbackStatus={playback.status}
              playbackError={playback.error}
            />
          )}

          {inResult && track && (
            <Reveal track={track} round={round} room={room} />
          )}

          {room.settings.gameMode === "race" && inRound && (
            <GuessInput room={room} viewer={viewer} round={round} />
          )}

          {room.settings.gameMode === "race" && inRound && isHost && (
            <SkipRoundButton code={room.code} />
          )}

          {room.settings.gameMode === "turns" && inRound && (
            <TurnView
              room={room}
              viewer={viewer}
              round={round}
              isHost={isHost}
            />
          )}

          {isHost && inResult && (
            <NextRoundButton room={room} />
          )}
        </div>

        <Scoreboard room={room} viewer={viewer} />
      </div>
    </section>
  );
}

function RoundHeader({ room }: { room: PublicRoom }) {
  const idx = room.rounds.length;
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-fg-muted">
          Round {idx} / {room.settings.rounds}
        </p>
        <h2 className="text-2xl font-black sm:text-3xl">
          {room.settings.gameMode === "race" ? "Race to name it" : "Whose turn?"}
        </h2>
      </div>
      <div className="font-mono text-xs text-fg-muted">{room.code}</div>
    </div>
  );
}

function NowPlaying({
  durationMs,
  startedAt,
  shouldPlay,
  isPremium,
  playbackStatus,
  playbackError,
}: {
  durationMs: number;
  startedAt: number | null;
  shouldPlay: boolean;
  isPremium: boolean;
  playbackStatus: string;
  playbackError: string | null;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const elapsed = Math.min(durationMs, Date.now() - startedAt);
      setProgress(elapsed / durationMs);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startedAt, durationMs]);

  return (
    <div className="rounded-3xl border border-border bg-bg-elev p-6">
      <div className="flex items-center gap-4">
        <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-accent/15 text-accent">
          <span className="text-2xl">🎵</span>
          <span className="absolute inset-0 rounded-2xl pulse-ring" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Now playing</p>
          <p className="text-xs text-fg-muted">
            {shouldPlay
              ? isPremium
                ? playbackStatus === "ready"
                  ? "Streaming on this device"
                  : playbackStatus === "loading"
                    ? "Connecting to Spotify…"
                    : playbackError ?? "Playback unavailable"
                : "Premium needed for in-app playback"
              : "Listening on host's speaker"}
          </p>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg-elev-2">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

function GuessInput({
  room,
  viewer,
  round,
}: {
  room: PublicRoom;
  viewer: Viewer;
  round: PublicRoom["rounds"][number] | undefined;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const myGuesses = useMemo(
    () => round?.guesses.filter((g) => g.playerId === viewer.id) ?? [],
    [round, viewer.id],
  );
  const haveTitle = myGuesses.some((g) => g.titleHit);
  const haveArtist = myGuesses.some((g) => g.artistHit);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setHint(null);
    try {
      const res = await fetch(`/api/rooms/${room.code}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        titleHit?: boolean;
        artistHit?: boolean;
        points?: number;
        error?: string;
      };
      if (!res.ok) {
        setHint(data.error ?? "Couldn't submit");
      } else if (data.titleHit && data.artistHit) {
        setHint(`+${data.points} — title & artist!`);
      } else if (data.titleHit) {
        setHint(`+${data.points} — title hit. Now the artist…`);
      } else if (data.artistHit) {
        setHint(`+${data.points} — artist hit. Now the title…`);
      } else {
        setHint("Not quite. Keep going.");
      }
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <Pill on={haveTitle}>title {haveTitle ? "✓" : ""}</Pill>
        <Pill on={haveArtist}>artist {haveArtist ? "✓" : ""}</Pill>
      </div>
      <div className="flex gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type the title or the artist…"
          className="h-12 flex-1 rounded-full border border-border bg-bg-elev px-5 text-base outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="h-12 rounded-full bg-fg px-6 text-sm font-semibold text-bg transition hover:bg-fg/90 disabled:opacity-50"
        >
          Guess
        </button>
      </div>
      {hint && <p className="text-xs text-fg-muted">{hint}</p>}
    </form>
  );
}

function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-3 py-1 font-semibold uppercase tracking-wider ${
        on ? "bg-accent/15 text-accent" : "bg-bg-elev text-fg-muted"
      }`}
    >
      {children}
    </span>
  );
}

function TurnView({
  room,
  viewer,
  round,
  isHost,
}: {
  room: PublicRoom;
  viewer: Viewer;
  round: PublicRoom["rounds"][number] | undefined;
  isHost: boolean;
}) {
  const activePlayer = room.players.find((p) => p.id === round?.activePlayerId);
  const isMyTurn = round?.activePlayerId === viewer.id;

  return (
    <div className="rounded-3xl border border-border bg-bg-elev p-6 text-center">
      <p className="text-xs uppercase tracking-widest text-fg-muted">
        On the spot
      </p>
      <p className="mt-2 text-2xl font-black">
        {isMyTurn ? "Your turn" : `${activePlayer?.name ?? "—"}'s turn`}
      </p>
      <p className="mt-2 text-sm text-fg-muted">
        Say the title and the artist out loud. Host scores it.
      </p>
      {isHost && round && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <p className="text-xs text-fg-muted">Score this round (host)</p>
          <ScoreButtons room={room} round={round} />
        </div>
      )}
    </div>
  );
}

function ScoreButtons({
  room,
  round,
}: {
  room: PublicRoom;
  round: PublicRoom["rounds"][number];
}) {
  const myHits = round.guesses.filter((g) => g.playerId === round.activePlayerId);
  const haveTitle = myHits.some((g) => g.titleHit);
  const haveArtist = myHits.some((g) => g.artistHit);

  async function award(field: "title" | "artist") {
    if (!round.activePlayerId) return;
    await fetch(`/api/rooms/${room.code}/award`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: round.activePlayerId,
        titleHit: field === "title" ? true : undefined,
        artistHit: field === "artist" ? true : undefined,
      }),
    });
  }
  async function reveal() {
    await fetch(`/api/rooms/${room.code}/round?action=end`, { method: "POST" });
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={() => award("title")}
        disabled={haveTitle}
        className="rounded-full border border-border bg-bg-elev-2 px-3 py-1 text-xs hover:border-accent disabled:opacity-40"
      >
        {haveTitle ? "✓ title" : "Got title"}
      </button>
      <button
        onClick={() => award("artist")}
        disabled={haveArtist}
        className="rounded-full border border-border bg-bg-elev-2 px-3 py-1 text-xs hover:border-accent disabled:opacity-40"
      >
        {haveArtist ? "✓ artist" : "Got artist"}
      </button>
      <button
        onClick={reveal}
        className="rounded-full bg-fg px-3 py-1 text-xs font-semibold text-bg"
      >
        Reveal & next
      </button>
    </div>
  );
}

function Reveal({
  track,
  round,
  room,
}: {
  track: NonNullable<PublicRoom["currentTrack"]>;
  round: PublicRoom["rounds"][number] | undefined;
  room: PublicRoom;
}) {
  const winner = room.players.find((p) => p.id === round?.winnerId);
  return (
    <div className="rounded-3xl border border-accent/40 bg-accent/5 p-6">
      <p className="text-xs uppercase tracking-widest text-accent">It was…</p>
      <p className="mt-1 text-3xl font-black">{track.name}</p>
      <p className="text-fg-muted">{track.artists?.join(", ")}</p>
      {track.ownerNames.length > 0 && (
        <p className="mt-3 text-xs text-fg-muted">
          In the libraries of:{" "}
          <span className="text-fg">{track.ownerNames.join(", ")}</span>
        </p>
      )}
      {winner && (
        <p className="mt-4 text-sm">
          🏆 <span className="font-semibold">{winner.name}</span> nailed it
        </p>
      )}
    </div>
  );
}

function SkipRoundButton({ code }: { code: string }) {
  const [loading, setLoading] = useState(false);
  async function skip() {
    setLoading(true);
    await fetch(`/api/rooms/${code}/round?action=end`, { method: "POST" });
    setLoading(false);
  }
  return (
    <button
      onClick={skip}
      disabled={loading}
      className="self-start rounded-full border border-border bg-bg-elev px-4 py-1.5 text-xs text-fg-muted transition hover:border-fg-muted hover:text-fg disabled:opacity-50"
    >
      {loading ? "…" : "Skip / reveal"}
    </button>
  );
}

function NextRoundButton({ room }: { room: PublicRoom }) {
  const [loading, setLoading] = useState(false);
  const isLast = room.rounds.length >= room.settings.rounds;
  async function go() {
    setLoading(true);
    await fetch(`/api/rooms/${room.code}/round`, { method: "POST" });
    setLoading(false);
  }
  return (
    <button
      onClick={go}
      disabled={loading}
      className="flex h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
    >
      {loading ? <span className="spinner" /> : isLast ? "Show final scores →" : "Next round →"}
    </button>
  );
}

function Scoreboard({ room, viewer }: { room: PublicRoom; viewer: Viewer }) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  return (
    <aside className="space-y-3 rounded-3xl border border-border bg-bg-elev p-5 lg:sticky lg:top-4 lg:self-start">
      <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
        Scoreboard
      </p>
      <ul className="space-y-2">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded-xl px-3 py-2 ${
              p.id === viewer.id ? "bg-accent/10" : "bg-bg-elev-2/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-4 text-center font-mono text-xs text-fg-muted">
                {i + 1}
              </span>
              <span className="text-sm font-semibold">{p.name}</span>
            </div>
            <span className="font-mono text-base font-black">{p.score}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
