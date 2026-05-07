"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const SDK_READY_TIMEOUT_MS = 6000;

export type PlaybackStatus = "idle" | "loading" | "ready" | "error";
export type PlaybackEngine = "sdk" | "preview" | null;

interface UsePlaybackOptions {
  enabled: boolean;
  name: string;
}

interface PlayTarget {
  uri: string;
  previewUrl: string | null;
}

interface UsePlaybackResult {
  status: PlaybackStatus;
  engine: PlaybackEngine;
  deviceId: string | null;
  error: string | null;
  /** Returns true if audio actually started, false if no playable source. */
  play: (target: PlayTarget, positionMs?: number) => Promise<boolean>;
  pause: () => Promise<void>;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("/api/spotify/token", { cache: "no-store" });
  if (!res.ok) throw new Error("Couldn't load Spotify token");
  const { accessToken } = (await res.json()) as { accessToken: string };
  return accessToken;
}

function isiOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac with touch support
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
}

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SDK_SRC}"]`)) {
      const check = setInterval(() => {
        if (window.Spotify) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
    document.body.appendChild(script);
  });
}

export function usePlayback({ enabled, name }: UsePlaybackOptions): UsePlaybackResult {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [engine, setEngine] = useState<PlaybackEngine>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const tokenRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // iOS Safari can't run the Web Playback SDK reliably. Skip it entirely and
  // use the preview-MP3 fallback. On other platforms we attempt the SDK first
  // and fall through to preview if it fails or doesn't go ready in time.
  const skipSdk = isiOS();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    // Always have an <audio> element available as the fallback engine.
    if (typeof window !== "undefined" && !audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      audioRef.current = a;
    }

    if (skipSdk) {
      setStatus("ready");
      setEngine("preview");
      return () => {
        cancelled = true;
        audioRef.current?.pause();
      };
    }

    setStatus("loading");

    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        await loadSdk();
        if (cancelled) return;

        const player = new window.Spotify!.Player({
          name,
          getOAuthToken: (cb) => {
            getAccessToken()
              .then((t) => {
                tokenRef.current = t;
                cb(t);
              })
              .catch((err) => setError(err.message));
          },
          volume: 0.7,
        });

        player.addListener("ready", ({ device_id }) => {
          if (cancelled) return;
          if (readyTimer) clearTimeout(readyTimer);
          setDeviceId(device_id);
          setStatus("ready");
          setEngine("sdk");
        });
        player.addListener("not_ready", () => {
          if (cancelled) return;
          setStatus("idle");
        });
        for (const evt of [
          "initialization_error",
          "authentication_error",
          "account_error",
          "playback_error",
        ] as const) {
          player.addListener(evt, ({ message }) => {
            if (cancelled) return;
            // Don't crash — fall through to preview engine.
            console.warn(`[playback] ${evt}: ${message}`);
            setEngine("preview");
            setStatus("ready");
          });
        }

        // If the SDK doesn't reach "ready" within a few seconds, fall back to
        // preview-only mode so the player isn't stuck.
        readyTimer = setTimeout(() => {
          if (cancelled) return;
          setEngine((prev) => prev ?? "preview");
          setStatus((prev) => (prev === "ready" ? prev : "ready"));
        }, SDK_READY_TIMEOUT_MS);

        const ok = await player.connect();
        if (!ok && !cancelled) {
          setEngine("preview");
          setStatus("ready");
        }
        playerRef.current = player;
      } catch (err) {
        if (cancelled) return;
        console.warn("[playback] SDK init failed", err);
        setEngine("preview");
        setStatus("ready");
      }
    })();

    return () => {
      cancelled = true;
      if (readyTimer) clearTimeout(readyTimer);
      playerRef.current?.disconnect();
      playerRef.current = null;
      audioRef.current?.pause();
    };
  }, [enabled, name, skipSdk]);

  const play = useCallback(
    async (target: PlayTarget, positionMs = 0): Promise<boolean> => {
      // Prefer SDK if it's actively the chosen engine and ready.
      if (engine === "sdk" && deviceId) {
        try {
          const token = tokenRef.current ?? (await getAccessToken());
          tokenRef.current = token;
          const res = await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ uris: [target.uri], position_ms: positionMs }),
            },
          );
          if (res.ok || res.status === 204) return true;
          console.warn("[playback] SDK play failed", res.status, "— falling through to preview");
        } catch (err) {
          console.warn("[playback] SDK play error", err);
        }
      }

      // Preview fallback.
      const audio = audioRef.current;
      if (!audio) return false;
      if (!target.previewUrl) {
        setError("This track has no preview clip available.");
        return false;
      }
      try {
        audio.src = target.previewUrl;
        // Snippets in the game start mid-track on the SDK; preview is its own
        // 30s clip (Spotify-curated highlight), so we just play from start.
        audio.currentTime = 0;
        await audio.play();
        setError(null);
        return true;
      } catch (err) {
        // Autoplay-blocked: surface a clear error so the UI can show a tap-to-play.
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Browser blocked autoplay. Tap below to start audio."
            : "Couldn't start audio.",
        );
        return false;
      }
    },
    [engine, deviceId],
  );

  const pause = useCallback(async () => {
    if (playerRef.current) {
      try {
        await playerRef.current.pause();
      } catch {
        // ignore
      }
    }
    audioRef.current?.pause();
  }, []);

  return { status, engine, deviceId, error, play, pause };
}
