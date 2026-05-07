"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Lobby } from "./Lobby";
import { GameView } from "./GameView";
import { FinalScoreboard } from "./FinalScoreboard";
import type { PublicGameEvent, PublicRoom } from "@/lib/types";

export interface Viewer {
  id: string;
  name: string;
  image: string | null;
  isPremium: boolean;
}

export function RoomClient({
  initialRoom,
  viewer,
}: {
  initialRoom: PublicRoom;
  viewer: Viewer;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [connected, setConnected] = useState(false);
  const router = useRouter();
  const joinedRef = useRef(false);

  // Auto-join if the viewer isn't yet in the room (deep-linked via URL).
  useEffect(() => {
    if (joinedRef.current) return;
    const inRoom = room.players.some((p) => p.id === viewer.id);
    if (inRoom) {
      joinedRef.current = true;
      return;
    }
    if (room.status !== "lobby") return;
    joinedRef.current = true;
    fetch(`/api/rooms/${room.code}/join`, { method: "POST" }).catch(() => {});
  }, [room, viewer.id]);

  // Subscribe to SSE for live updates.
  useEffect(() => {
    const es = new EventSource(`/api/rooms/${room.code}/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as PublicGameEvent;
        if (ev.room) setRoom(ev.room);
      } catch {
        // ignore
      }
    };
    return () => es.close();
  }, [room.code]);

  // Best-effort leave on tab close (avoids ghost players in the lobby).
  useEffect(() => {
    function leave() {
      navigator.sendBeacon(`/api/rooms/${room.code}/leave`);
    }
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [room.code]);

  const isHost = room.hostId === viewer.id;

  const view = useMemo(() => {
    if (room.status === "finished") {
      return <FinalScoreboard room={room} viewer={viewer} onAgain={() => router.push("/host")} />;
    }
    if (room.status === "lobby" || room.status === "loading-songs") {
      return <Lobby room={room} viewer={viewer} isHost={isHost} />;
    }
    return <GameView room={room} viewer={viewer} isHost={isHost} />;
  }, [room, viewer, isHost, router]);

  return (
    <main className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              connected ? "bg-accent/15 text-accent" : "bg-bg-elev text-fg-muted"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "bg-accent" : "bg-fg-muted"
              }`}
            />
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </div>
      </header>
      {view}
    </main>
  );
}
