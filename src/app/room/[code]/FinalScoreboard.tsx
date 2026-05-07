"use client";

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
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-16 text-center sm:px-10">
      <div>
        <p className="text-xs uppercase tracking-widest text-fg-muted">Game over</p>
        <h2 className="mt-2 text-5xl font-black tracking-tight sm:text-6xl">
          {winner?.name} wins
        </h2>
        <p className="mt-2 text-fg-muted">
          {winner?.score} {winner?.score === 1 ? "point" : "points"}
        </p>
      </div>

      <ul className="w-full space-y-2">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${
              i === 0
                ? "border-accent bg-accent/10"
                : "border-border bg-bg-elev"
            } ${p.id === viewer.id ? "ring-1 ring-accent/40" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="w-5 text-center font-mono text-fg-muted">
                {i + 1}
              </span>
              <span className="text-lg font-semibold">{p.name}</span>
            </div>
            <span className="font-mono text-2xl font-black">{p.score}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onAgain}
        className="h-12 rounded-full bg-accent px-8 text-sm font-semibold text-accent-fg hover:bg-accent-hover"
      >
        Play again
      </button>
    </section>
  );
}
