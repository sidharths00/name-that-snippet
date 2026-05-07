"use client";

import { useState } from "react";
import type { PublicRoom } from "@/lib/types";
import type { Viewer } from "./RoomClient";

export function Lobby({
  room,
  viewer,
  isHost,
}: {
  room: PublicRoom;
  viewer: Viewer;
  isHost: boolean;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const playbackBlocked =
    room.settings.playbackMode === "everyone" &&
    room.players.some((p) => !p.isPremium);

  const hostMissingPremium =
    room.settings.playbackMode === "host-only" &&
    !room.players.find((p) => p.id === room.hostId)?.isPremium;

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${room.code}/start`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Couldn't start");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start");
      setStarting(false);
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareCode() {
    const url = `${window.location.origin}/room/${room.code}`;
    const text = `Join my Name That Snippet game — code ${room.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Name That Snippet", text, url });
        return;
      } catch {
        // User cancelled — fall through to clipboard.
      }
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const modeLabel =
    room.settings.gameMode === "race"
      ? "Race"
      : room.settings.gameMode === "speed"
        ? "Speed"
        : "Turns";

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:gap-8 sm:py-8 sm:px-10">
      <div className="rounded-3xl border border-border bg-bg-elev p-5 text-center sm:p-8">
        <p className="text-xs uppercase tracking-widest text-fg-muted">Room code</p>
        <button
          onClick={copyCode}
          className="mt-2 flex w-full flex-col items-center gap-1 transition hover:opacity-80 active:scale-[0.99] sm:flex-row sm:justify-center sm:items-baseline sm:gap-3"
          aria-label="Copy room code"
        >
          <span className="font-mono text-6xl font-black tracking-[0.18em] sm:text-7xl">
            {room.code}
          </span>
          <span className="text-xs font-medium text-fg-muted">
            {copied ? "copied!" : "tap to copy"}
          </span>
        </button>
        <p className="mt-3 text-sm text-fg-muted">
          Friends sign in here and tap <span className="text-fg">Join</span>.
        </p>
        <button
          onClick={shareCode}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-bg-elev-2 px-4 text-xs font-semibold transition hover:border-fg-muted"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share invite
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Stat label="Mode" value={modeLabel} />
        <Stat
          label="Playback"
          value={room.settings.playbackMode === "host-only" ? "Host plays" : "Everyone plays"}
        />
        <Stat label="Rounds" value={`${room.settings.rounds}`} />
        <Stat label="Snippet" value={`${room.settings.snippetSeconds}s`} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-fg-muted">
          Players ({room.players.length})
        </p>
        <ul className="mt-3 grid gap-2">
          {room.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-bg-elev px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-bg-elev-2 text-sm font-semibold">
                    {p.name[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">
                    {p.name}
                    {p.id === viewer.id && (
                      <span className="ml-1.5 text-xs text-fg-muted">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {p.isHost && "Host · "}
                    {p.isPremium ? "Premium" : "Free"}
                  </p>
                </div>
              </div>
              {p.isHost && <span className="text-xs">🎙</span>}
            </li>
          ))}
        </ul>
      </div>

      {playbackBlocked && (
        <p className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          Heads up: &ldquo;everyone plays&rdquo; needs Spotify Premium for every
          player. Switch to &ldquo;host plays&rdquo; or have free players upgrade.
        </p>
      )}
      {hostMissingPremium && (
        <p className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          The host needs Spotify Premium to play in &ldquo;host plays&rdquo; mode.
        </p>
      )}

      {isHost ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={start}
            disabled={
              starting ||
              room.status === "loading-songs" ||
              room.players.length < 1
            }
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
          >
            {starting || room.status === "loading-songs" ? (
              <>
                <span className="spinner" /> Building song pool…
              </>
            ) : (
              <>Start game →</>
            )}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 text-center text-sm text-fg-muted">
          <span className="spinner" />
          Waiting for host to start…
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elev/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-fg-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
