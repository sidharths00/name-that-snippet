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

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8 sm:px-10">
      <div className="rounded-3xl border border-border bg-bg-elev p-6 text-center sm:p-8">
        <p className="text-xs uppercase tracking-widest text-fg-muted">Room code</p>
        <button
          onClick={copyCode}
          className="mt-2 flex w-full flex-col items-center gap-2 hover:opacity-80 sm:flex-row sm:justify-center sm:items-baseline sm:gap-3"
          aria-label="Copy room code"
        >
          <span className="font-mono text-5xl font-black tracking-[0.2em] sm:text-7xl">
            {room.code}
          </span>
          <span className="text-xs font-medium text-fg-muted">
            {copied ? "copied!" : "tap to copy"}
          </span>
        </button>
        <p className="mt-3 text-sm text-fg-muted">
          Share with friends. They sign in at this site and tap{" "}
          <span className="text-fg">Join</span>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Stat
          label="Mode"
          value={room.settings.gameMode === "race" ? "Race" : "Turns"}
        />
        <Stat
          label="Playback"
          value={
            room.settings.playbackMode === "host-only"
              ? "Host plays"
              : "Everyone plays"
          }
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
        <p className="text-center text-sm text-fg-muted">
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
