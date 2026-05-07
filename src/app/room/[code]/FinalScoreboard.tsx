"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicRoom } from "@/lib/types";
import type { Viewer } from "./RoomClient";

export function FinalScoreboard({
  room,
  viewer,
  onAgain,
}: {
  room: PublicRoom;
  viewer: Viewer;
  onAgain: () => void;
}) {
  const sorted = useMemo(
    () => [...room.players].sort((a, b) => b.score - a.score),
    [room.players],
  );
  const winner = sorted[0];
  const myRank = sorted.findIndex((p) => p.id === viewer.id) + 1;
  const me = sorted.find((p) => p.id === viewer.id);
  const isSolo = sorted.length === 1;
  const youWon = winner?.id === viewer.id;

  // Cute reveal: count up the winner's score from 0 once on mount.
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!winner) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 800);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(winner.score * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [winner]);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 pb-16 text-center sm:px-6 sm:px-10">
      {!isSolo && youWon && <Confetti />}

      <div>
        <p className="text-xs uppercase tracking-widest text-fg-muted">Final score</p>
        <h2 className="mt-2 text-balance text-4xl font-black leading-none tracking-tight sm:text-6xl">
          {isSolo
            ? "Nice run."
            : youWon
              ? "You win 🏆"
              : `${winner?.name} wins`}
        </h2>
        <p className="mt-3 font-mono text-3xl font-black text-accent tabular-nums">
          {count}
          <span className="ml-1 text-base font-medium text-fg-muted">
            {(winner?.score ?? 0) === 1 ? "pt" : "pts"}
          </span>
        </p>
        {!isSolo && me && me.id !== winner?.id && (
          <p className="mt-3 text-sm text-fg-muted">
            You finished #{myRank} with{" "}
            <span className="font-mono font-semibold text-fg">{me.score}</span>{" "}
            pts
          </p>
        )}
      </div>

      {!isSolo && (
        <ul className="w-full space-y-2">
          {sorted.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition sm:px-5 sm:py-4 ${
                i === 0
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-elev"
              } ${p.id === viewer.id ? "ring-1 ring-accent/40" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-5 shrink-0 text-center font-mono text-fg-muted">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>
                <span className="truncate text-base font-semibold sm:text-lg">
                  {p.name}
                </span>
              </div>
              <span className="ml-2 shrink-0 font-mono text-xl font-black tabular-nums sm:text-2xl">
                {p.score}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <button
          onClick={onAgain}
          className="h-12 rounded-full bg-accent px-8 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
        >
          Play again
        </button>
        <a
          href="/"
          className="h-12 rounded-full border border-border bg-bg-elev px-6 text-sm font-semibold leading-[3rem] text-fg transition hover:border-fg-muted"
        >
          Home
        </a>
      </div>
    </section>
  );
}

// CSS-only confetti — generates ~24 colored dots that fall and rotate.
function Confetti() {
  const colors = ["#1ed760", "#7d63ff", "#ff5d8f", "#ffd166", "#4ddae8"];
  const pieces = Array.from({ length: 28 }).map((_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.6 + Math.random() * 1.2,
    color: colors[i % colors.length],
    rotate: Math.random() * 360,
  }));
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute -top-4 block h-2.5 w-2.5 rounded-sm"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
