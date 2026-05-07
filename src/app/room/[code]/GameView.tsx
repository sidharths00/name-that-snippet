"use client";

import Image from "next/image";
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

  const shouldPlay =
    (room.settings.playbackMode === "host-only" && isHost) ||
    room.settings.playbackMode === "everyone";

  const playback = usePlayback({
    enabled: shouldPlay && viewer.isPremium,
    name: `Name That Snippet — ${viewer.name}`,
  });

  const playedTrackIdRef = useRef<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  useEffect(() => {
    if (!shouldPlay || !track || !inRound) return;
    if (playback.status !== "ready") return;
    if (playedTrackIdRef.current === track.id) return;
    playedTrackIdRef.current = track.id;
    setNeedsTap(false);
    playback.play({ uri: track.uri, previewUrl: track.previewUrl }, DEFAULT_START_OFFSET_MS).then(
      (ok) => {
        if (!ok) setNeedsTap(true);
      },
      (err) => {
        console.error("[playback] play failed", err);
        setNeedsTap(true);
      },
    );
  }, [shouldPlay, track, inRound, playback]);

  async function tapToPlay() {
    if (!track) return;
    const ok = await playback.play(
      { uri: track.uri, previewUrl: track.previewUrl },
      DEFAULT_START_OFFSET_MS,
    );
    if (ok) setNeedsTap(false);
  }

  useEffect(() => {
    if (inResult && shouldPlay) {
      playback.pause().catch(() => {});
    }
    if (room.status === "in-round" && !inRound) {
      playedTrackIdRef.current = null;
    }
  }, [inResult, inRound, shouldPlay, playback, room.status]);

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-10 pt-2 sm:px-6 sm:gap-6 sm:px-10">
      <RoundHeader room={room} viewer={viewer} />

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-5 sm:gap-6">
          {inRound && (
            <NowPlaying
              durationMs={room.settings.snippetSeconds * 1000}
              startedAt={round?.startedAt ?? null}
              shouldPlay={shouldPlay}
              isPremium={viewer.isPremium}
              playbackStatus={playback.status}
              playbackEngine={playback.engine}
              playbackError={playback.error}
              hasPreview={!!track?.previewUrl}
              needsTap={needsTap}
              onTap={tapToPlay}
            />
          )}

          {inResult && track && (
            <Reveal track={track} round={round} room={room} viewer={viewer} />
          )}

          {(room.settings.gameMode === "race" || room.settings.gameMode === "speed") &&
            inRound && <GuessInput room={room} viewer={viewer} round={round} />}

          {(room.settings.gameMode === "race" || room.settings.gameMode === "speed") &&
            inRound && isHost && <SkipRoundButton code={room.code} mode={room.settings.gameMode} />}

          {room.settings.gameMode === "turns" && inRound && (
            <TurnView room={room} viewer={viewer} round={round} isHost={isHost} />
          )}

          {inResult && isHost && <NextRoundButton room={room} />}
          {inResult && !isHost && <WaitingForHost />}
        </div>

        <Scoreboard room={room} viewer={viewer} />
      </div>
    </section>
  );
}

function RoundHeader({ room, viewer }: { room: PublicRoom; viewer: Viewer }) {
  const idx = room.rounds.length;
  const me = room.players.find((p) => p.id === viewer.id);
  const modeLabel =
    room.settings.gameMode === "race"
      ? "Race"
      : room.settings.gameMode === "speed"
        ? "Speed"
        : "Turns";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-fg-muted">
          <span className="rounded-full bg-bg-elev px-2.5 py-1 font-semibold text-fg">
            {modeLabel}
          </span>
          <span>
            Round <span className="font-semibold text-fg">{idx}</span> /{" "}
            {room.settings.rounds}
          </span>
        </div>
        {me && (
          <div className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
            <span className="text-fg-muted">you</span>
            <span className="font-mono">{me.score}</span>
          </div>
        )}
      </div>
      <RoundProgress current={idx} total={room.settings.rounds} />
    </div>
  );
}

function RoundProgress({ current, total }: { current: number; total: number }) {
  // Show as dots if total is small; bar otherwise.
  if (total <= 15) {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < current - 1 ? "bg-accent/60" : i === current - 1 ? "bg-accent" : "bg-bg-elev-2"
            }`}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="h-1 overflow-hidden rounded-full bg-bg-elev-2">
      <div
        className="h-full rounded-full bg-accent transition-[width]"
        style={{ width: `${Math.max(0, Math.min(100, ((current - 0.5) / total) * 100))}%` }}
      />
    </div>
  );
}

function NowPlaying({
  durationMs,
  startedAt,
  shouldPlay,
  isPremium,
  playbackStatus,
  playbackEngine,
  playbackError,
  hasPreview,
  needsTap,
  onTap,
}: {
  durationMs: number;
  startedAt: number | null;
  shouldPlay: boolean;
  isPremium: boolean;
  playbackStatus: string;
  playbackEngine: "sdk" | "preview" | null;
  playbackError: string | null;
  hasPreview: boolean;
  needsTap: boolean;
  onTap: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationMs / 1000));
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const elapsed = Math.min(durationMs, Date.now() - startedAt);
      setProgress(elapsed / durationMs);
      setSecondsLeft(Math.max(0, Math.ceil((durationMs - elapsed) / 1000)));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [startedAt, durationMs]);

  const status = !shouldPlay
    ? "Listening on host's speaker"
    : !isPremium
      ? "Premium needed for in-app playback"
      : playbackStatus === "loading"
        ? "Connecting to Spotify…"
        : playbackEngine === "preview" && !hasPreview
          ? "No preview available — skip with host's button"
          : playbackEngine === "preview"
            ? "Playing 30s preview"
            : playbackStatus === "ready"
              ? "Streaming on this device"
              : (playbackError ?? "Playback unavailable");

  const timeIsUp = secondsLeft <= 0;
  return (
    <div className="rounded-3xl border border-border bg-bg-elev p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent sm:h-16 sm:w-16">
          <span className="text-2xl">🎵</span>
          <span className="absolute inset-0 rounded-2xl pulse-ring" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Now playing</p>
            <p
              className={`font-mono text-sm tabular-nums ${
                timeIsUp ? "text-warn" : secondsLeft <= 5 ? "text-warn" : "text-fg-muted"
              }`}
            >
              {timeIsUp ? "0s" : `${secondsLeft}s`}
            </p>
          </div>
          <p className="truncate text-xs text-fg-muted">{status}</p>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg-elev-2">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {needsTap && shouldPlay && (
        <button
          onClick={onTap}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-accent-fg transition active:scale-[0.99]"
        >
          ▶ Tap to start audio
        </button>
      )}
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
  const [feedback, setFeedback] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  const myGuesses = useMemo(
    () => round?.guesses.filter((g) => g.playerId === viewer.id) ?? [],
    [round, viewer.id],
  );
  const haveTitle = myGuesses.some((g) => g.titleHit);
  const haveArtist = myGuesses.some((g) => g.artistHit);

  // Clear feedback after a moment so it doesn't linger forever.
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 2200);
    return () => clearTimeout(id);
  }, [feedback]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
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
        setFeedback({ kind: "err", text: data.error ?? "Couldn't submit" });
      } else if (data.titleHit && data.artistHit) {
        setFeedback({ kind: "ok", text: `+${data.points} — title & artist!` });
      } else if (data.titleHit) {
        setFeedback({ kind: "ok", text: `+${data.points} — title hit. Now the artist.` });
      } else if (data.artistHit) {
        setFeedback({ kind: "ok", text: `+${data.points} — artist hit. Now the title.` });
      } else {
        setFeedback({ kind: "warn", text: "Not quite. Keep going." });
      }
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] sm:text-xs">
        <Pill on={haveTitle}>title{haveTitle ? " ✓" : ""}</Pill>
        <Pill on={haveArtist}>artist{haveArtist ? " ✓" : ""}</Pill>
        <span className="ml-auto text-fg-muted">
          {haveTitle && haveArtist ? "All hit. Wait for next round." : ""}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder={haveTitle && haveArtist ? "You got it." : "Title or artist…"}
          disabled={haveTitle && haveArtist}
          className="h-12 flex-1 rounded-full border border-border bg-bg-elev px-5 text-base outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={submitting || !text.trim() || (haveTitle && haveArtist)}
          className="h-12 rounded-full bg-fg px-5 text-sm font-semibold text-bg transition hover:bg-fg/90 disabled:opacity-40 sm:px-6"
        >
          {submitting ? "…" : "Guess"}
        </button>
      </div>
      <div className="min-h-[1.25rem]">
        {feedback && (
          <p
            className={`text-xs font-medium ${
              feedback.kind === "ok"
                ? "text-accent"
                : feedback.kind === "warn"
                  ? "text-fg-muted"
                  : "text-danger"
            }`}
            role="status"
            aria-live="polite"
          >
            {feedback.text}
          </p>
        )}
      </div>
    </form>
  );
}

function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-semibold uppercase tracking-wider sm:px-3 ${
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
      <p className="text-xs uppercase tracking-widest text-fg-muted">On the spot</p>
      <p className="mt-2 text-2xl font-black sm:text-3xl">
        {isMyTurn ? "Your turn" : `${activePlayer?.name ?? "—"}'s turn`}
      </p>
      <p className="mt-2 text-sm text-fg-muted">
        Say the title and the artist out loud. Host scores it.
      </p>
      {isHost && round && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <p className="text-xs text-fg-muted">Score this round</p>
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
        className="h-9 rounded-full border border-border bg-bg-elev-2 px-4 text-xs font-semibold transition hover:border-accent disabled:opacity-40"
      >
        {haveTitle ? "✓ title" : "Got title"}
      </button>
      <button
        onClick={() => award("artist")}
        disabled={haveArtist}
        className="h-9 rounded-full border border-border bg-bg-elev-2 px-4 text-xs font-semibold transition hover:border-accent disabled:opacity-40"
      >
        {haveArtist ? "✓ artist" : "Got artist"}
      </button>
      <button
        onClick={reveal}
        className="h-9 rounded-full bg-fg px-4 text-xs font-semibold text-bg"
      >
        Reveal & next →
      </button>
    </div>
  );
}

function Reveal({
  track,
  round,
  room,
  viewer,
}: {
  track: NonNullable<PublicRoom["currentTrack"]>;
  round: PublicRoom["rounds"][number] | undefined;
  room: PublicRoom;
  viewer: Viewer;
}) {
  const winner = room.players.find((p) => p.id === round?.winnerId);
  const myGuesses = round?.guesses.filter((g) => g.playerId === viewer.id) ?? [];
  const myPoints = myGuesses.reduce((sum, g) => sum + g.points, 0);

  return (
    <div className="overflow-hidden rounded-3xl border border-accent/40 bg-accent/5">
      <div className="flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left sm:p-6">
        {track.albumImage ? (
          <Image
            src={track.albumImage}
            alt=""
            width={120}
            height={120}
            className="h-28 w-28 shrink-0 rounded-2xl object-cover shadow-lg sm:h-32 sm:w-32"
            unoptimized
          />
        ) : (
          <div className="grid h-28 w-28 shrink-0 place-items-center rounded-2xl bg-bg-elev-2 text-3xl sm:h-32 sm:w-32">
            🎵
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent sm:text-xs">
            It was…
          </p>
          <p className="mt-1 break-words text-2xl font-black leading-tight sm:text-3xl">
            {track.name}
          </p>
          <p className="mt-1 break-words text-sm text-fg-muted sm:text-base">
            {track.artists?.join(", ")}
          </p>
          {track.ownerNames.length > 0 && (
            <p className="mt-3 text-xs text-fg-muted">
              In{" "}
              <span className="text-fg">
                {track.ownerNames.length === 1
                  ? `${track.ownerNames[0]}'s`
                  : `${track.ownerNames.join(", ")}'`}
              </span>{" "}
              library
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-accent/20 bg-bg-elev/40 px-5 py-3 text-xs sm:px-6">
        <span className="text-fg-muted">{footerLine(room, round, viewer, winner)}</span>
        {myPoints > 0 && (
          <span className="font-semibold text-accent">+{myPoints} pts for you</span>
        )}
      </div>
    </div>
  );
}

function footerLine(
  room: PublicRoom,
  round: PublicRoom["rounds"][number] | undefined,
  viewer: Viewer,
  winner: PublicRoom["players"][number] | undefined,
): React.ReactNode {
  if (!round) return null;
  if (room.settings.gameMode === "race") {
    if (!winner) return "No one got it this round";
    return (
      <>
        🏆 <span className="font-semibold text-fg">{winner.name}</span>
        {winner.id === viewer.id ? " (you!)" : ""} won the round
      </>
    );
  }
  if (room.settings.gameMode === "speed") {
    // Top scorer this round
    const totals = new Map<string, number>();
    for (const g of round.guesses) {
      totals.set(g.playerId, (totals.get(g.playerId) ?? 0) + g.points);
    }
    let topId: string | null = null;
    let topPts = 0;
    for (const [id, pts] of totals) {
      if (pts > topPts) {
        topPts = pts;
        topId = id;
      }
    }
    if (!topId || topPts === 0) return "No one got it this round";
    const topPlayer = room.players.find((p) => p.id === topId);
    return (
      <>
        ⚡ <span className="font-semibold text-fg">{topPlayer?.name ?? "—"}</span>
        {topId === viewer.id ? " (you!)" : ""} was fastest ({topPts}pt)
      </>
    );
  }
  return null;
}

function SkipRoundButton({ code, mode }: { code: string; mode: "race" | "speed" }) {
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
      className="self-start rounded-full border border-border bg-bg-elev px-4 py-2 text-xs text-fg-muted transition hover:border-fg-muted hover:text-fg disabled:opacity-50"
    >
      {loading ? "…" : mode === "speed" ? "End round / reveal" : "Skip / reveal"}
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
      className="flex h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
    >
      {loading ? <span className="spinner" /> : isLast ? "Show final scores →" : "Next round →"}
    </button>
  );
}

function WaitingForHost() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-bg-elev/60 px-4 py-3 text-xs text-fg-muted">
      <span className="spinner" />
      Waiting for host to start the next round…
    </div>
  );
}

function Scoreboard({ room, viewer }: { room: PublicRoom; viewer: Viewer }) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const isSolo = room.players.length === 1;
  if (isSolo) return null; // No need for a scoreboard with one player; chip in header is enough.

  return (
    <aside className="order-first space-y-2 rounded-2xl border border-border bg-bg-elev p-3 sm:p-4 lg:order-none lg:sticky lg:top-4 lg:self-start lg:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted sm:text-xs">
        Scoreboard
      </p>
      <ul className="space-y-1.5 sm:space-y-2">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition sm:rounded-xl sm:px-3 sm:py-2 ${
              p.id === viewer.id ? "bg-accent/10 ring-1 ring-accent/30" : "bg-bg-elev-2/60"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-center font-mono text-xs text-fg-muted">
                {i + 1}
              </span>
              <span className="truncate text-sm font-semibold">
                {p.name}
                {p.id === viewer.id && (
                  <span className="ml-1 text-[10px] font-normal text-fg-muted">you</span>
                )}
              </span>
            </div>
            <span className="ml-2 shrink-0 font-mono text-base font-black tabular-nums">
              {p.score}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
