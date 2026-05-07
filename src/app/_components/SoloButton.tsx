"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SoloButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solo: true,
          gameMode: "race",
          playbackMode: "host-only",
          rounds: 10,
          snippetSeconds: 30,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Couldn't start solo");
      }
      const { code } = (await res.json()) as { code: string };
      router.push(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={go}
        disabled={loading}
        className="inline-flex h-10 items-center justify-center rounded-full bg-fg px-5 text-xs font-semibold text-bg transition hover:bg-fg/90 disabled:opacity-50"
      >
        {loading ? <span className="spinner" /> : "Play solo →"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
