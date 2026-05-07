"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 4) {
      setError("Codes are 4 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${cleaned}/join`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Couldn't join that room");
      }
      router.push(`/room/${cleaned}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          maxLength={4}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          placeholder="CODE"
          className="h-12 flex-1 rounded-full border border-border bg-bg-elev-2 px-4 text-center font-mono text-lg font-bold tracking-[0.3em] uppercase outline-none placeholder:text-fg-muted/50 focus:border-accent sm:tracking-[0.4em]"
        />
        <button
          type="submit"
          disabled={submitting || code.length < 4}
          className="h-12 rounded-full bg-fg px-6 text-sm font-semibold text-bg transition hover:bg-fg/90 disabled:opacity-50"
        >
          {submitting ? "…" : "Join"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
