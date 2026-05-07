"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { GameMode, PlaybackMode } from "@/lib/types";

export function CreateRoomForm() {
  const router = useRouter();
  const [gameMode, setGameMode] = useState<GameMode>("race");
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("host-only");
  const [rounds, setRounds] = useState(10);
  const [snippetSeconds, setSnippetSeconds] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameMode, playbackMode, rounds, snippetSeconds }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Couldn't create room");
      }
      const { code } = (await res.json()) as { code: string };
      router.push(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Group label="Playback" hint="Who hears the song?">
        <Choice
          name="playback"
          value="host-only"
          current={playbackMode}
          onChange={setPlaybackMode}
          title="Host plays on a speaker"
          body="Best for IRL — only the host needs Premium. Everyone listens together."
        />
        <Choice
          name="playback"
          value="everyone"
          current={playbackMode}
          onChange={setPlaybackMode}
          title="Everyone plays on their device"
          body="For remote play. Each player needs Spotify Premium to play in-browser."
        />
      </Group>

      <Group label="Game mode" hint="How do guesses work?">
        <Choice
          name="mode"
          value="race"
          current={gameMode}
          onChange={setGameMode}
          title="Race"
          body="First to get title + artist wins the round. Speed bonus."
        />
        <Choice
          name="mode"
          value="speed"
          current={gameMode}
          onChange={setGameMode}
          title="Speed"
          body="Everyone scores. Each correct hit is worth more the faster you get it."
        />
        <Choice
          name="mode"
          value="turns"
          current={gameMode}
          onChange={setGameMode}
          title="Turn-based"
          body="One player guesses out loud. Host scores them. Pass it on."
        />
      </Group>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="Rounds"
          value={rounds}
          min={3}
          max={30}
          onChange={setRounds}
          format={(v) => `${v} songs`}
        />
        <Slider
          label="Snippet length"
          value={snippetSeconds}
          min={5}
          max={60}
          step={5}
          onChange={setSnippetSeconds}
          format={(v) => `${v}s`}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
      >
        {submitting ? <span className="spinner" /> : "Create room →"}
      </button>
    </form>
  );
}

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{label}</p>
        <p className="text-xs text-fg-muted/70">{hint}</p>
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function Choice<T extends string>({
  name,
  value,
  current,
  onChange,
  title,
  body,
}: {
  name: string;
  value: T;
  current: T;
  onChange: (v: T) => void;
  title: string;
  body: string;
}) {
  const active = current === value;
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
        active
          ? "border-accent bg-accent/5"
          : "border-border bg-bg-elev hover:border-fg-muted/40"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={active}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <div
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
          active ? "border-accent" : "border-fg-muted/40"
        }`}
      >
        {active && <span className="h-2 w-2 rounded-full bg-accent" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-fg-muted">{body}</p>
      </div>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-bg-elev p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          {label}
        </span>
        <span className="font-mono text-sm font-semibold">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}
