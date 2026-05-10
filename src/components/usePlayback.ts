"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const SDK_READY_TIMEOUT_MS = 12_000;
const MAX_LOG_ENTRIES = 25;

export type PlaybackStatus = "idle" | "loading" | "ready" | "error";
export type PlaybackEngine = "sdk" | "preview" | null;

export interface PlaybackLogEntry {
  at: number;
  level: "info" | "warn" | "error";
  source: "sdk" | "preview" | "token" | "play" | "init";
  message: string;
}

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
  log: PlaybackLogEntry[];
  /** Returns true if audio actually started, false if no playable source. */
  play: (target: PlayTarget, positionMs?: number) => Promise<boolean>;
  pause: () => Promise<void>;
  /** Force a fresh SDK init pass (useful when something is stuck). */
  retry: () => void;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("/api/spotify/token", { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify token endpoint ${res.status}${body ? `: ${body}` : ""}`);
  }
  const { accessToken } = (await res.json()) as { accessToken: string };
  return accessToken;
}

function isiOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) ||
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
    script.onerror = () => reject(new Error("Failed to load Spotify SDK script"));
    document.body.appendChild(script);
  });
}

export function usePlayback({ enabled, name }: UsePlaybackOptions): UsePlaybackResult {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [engine, setEngine] = useState<PlaybackEngine>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<PlaybackLogEntry[]>([]);
  const [retryNonce, setRetryNonce] = useState(0);

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const tokenRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const skipSdk = isiOS();

  const appendLog = useCallback((entry: Omit<PlaybackLogEntry, "at">) => {
    setLog((prev) => {
      const next = [...prev, { ...entry, at: Date.now() }];
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
    });
    const tag = `[playback:${entry.source}]`;
    if (entry.level === "error") console.error(tag, entry.message);
    else if (entry.level === "warn") console.warn(tag, entry.message);
    else console.log(tag, entry.message);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setEngine(null);
    setDeviceId(null);
    setStatus("idle");
    setRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    if (typeof window !== "undefined" && !audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      audioRef.current = a;
    }

    if (skipSdk) {
      appendLog({ level: "info", source: "init", message: "iOS detected — using preview engine" });
      setStatus("ready");
      setEngine("preview");
      return () => {
        cancelled = true;
        audioRef.current?.pause();
      };
    }

    setStatus("loading");
    appendLog({ level: "info", source: "init", message: "Initializing Spotify Web Playback SDK" });

    let stuckTimer: ReturnType<typeof setTimeout> | null = null;
    let sdkReady = false;

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
                appendLog({ level: "info", source: "token", message: "Fresh access token loaded" });
              })
              .catch((err) => {
                const msg = err instanceof Error ? err.message : String(err);
                appendLog({ level: "error", source: "token", message: msg });
                setError(msg);
              });
          },
          volume: 0.7,
        });

        player.addListener("ready", ({ device_id }) => {
          if (cancelled) return;
          if (stuckTimer) clearTimeout(stuckTimer);
          sdkReady = true;
          setDeviceId(device_id);
          setStatus("ready");
          setEngine("sdk");
          appendLog({
            level: "info",
            source: "sdk",
            message: `SDK ready (device ${device_id.slice(0, 8)}…)`,
          });
        });
        player.addListener("not_ready", ({ device_id }) => {
          if (cancelled) return;
          setStatus("idle");
          appendLog({
            level: "warn",
            source: "sdk",
            message: `Device went offline (${device_id.slice(0, 8)}…)`,
          });
        });
        for (const evt of [
          "initialization_error",
          "authentication_error",
          "account_error",
          "playback_error",
        ] as const) {
          player.addListener(evt, ({ message }) => {
            if (cancelled) return;
            appendLog({ level: "error", source: "sdk", message: `${evt}: ${message}` });
            setError(`${evt}: ${message}`);
            setEngine("preview");
            setStatus("ready");
          });
        }

        const ok = await player.connect();
        if (!ok && !cancelled) {
          appendLog({
            level: "warn",
            source: "sdk",
            message: "player.connect() returned false — using preview engine",
          });
          setEngine("preview");
          setStatus("ready");
        }
        playerRef.current = player;

        stuckTimer = setTimeout(() => {
          if (cancelled || sdkReady) return;
          appendLog({
            level: "warn",
            source: "sdk",
            message: `SDK never reached ready in ${SDK_READY_TIMEOUT_MS}ms — falling back to preview`,
          });
          setEngine("preview");
          setStatus("ready");
        }, SDK_READY_TIMEOUT_MS);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        appendLog({ level: "error", source: "init", message: msg });
        setError(msg);
        setEngine("preview");
        setStatus("ready");
      }
    })();

    return () => {
      cancelled = true;
      if (stuckTimer) clearTimeout(stuckTimer);
      playerRef.current?.disconnect();
      playerRef.current = null;
      audioRef.current?.pause();
    };
  }, [enabled, name, skipSdk, retryNonce, appendLog]);

  const play = useCallback(
    async (target: PlayTarget, positionMs = 0): Promise<boolean> => {
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
          if (res.ok || res.status === 204) {
            appendLog({ level: "info", source: "play", message: `SDK play → ${res.status}` });
            setError(null);
            return true;
          }
          const body = await res.text().catch(() => "");
          appendLog({
            level: "warn",
            source: "play",
            message: `SDK play failed ${res.status}${body ? `: ${body.slice(0, 200)}` : ""} — trying preview`,
          });
          if (res.status === 404) {
            setError("Spotify device not registered yet. Trying preview clip…");
          } else if (res.status === 403) {
            setError("Spotify rejected playback (Premium required, region, or another device active).");
          } else if (res.status === 401) {
            setError("Spotify session expired. Sign in again.");
          } else {
            setError(`Spotify play returned ${res.status}.`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          appendLog({ level: "warn", source: "play", message: `SDK play threw: ${msg}` });
        }
      }

      const audio = audioRef.current;
      if (!audio) {
        appendLog({ level: "error", source: "preview", message: "No audio element available" });
        return false;
      }
      if (!target.previewUrl) {
        appendLog({ level: "warn", source: "preview", message: "Track has no preview URL" });
        setError("This track has no preview clip available — host can skip.");
        return false;
      }
      try {
        audio.src = target.previewUrl;
        audio.currentTime = 0;
        await audio.play();
        appendLog({ level: "info", source: "preview", message: "Playing 30s preview" });
        setError(null);
        return true;
      } catch (err) {
        const isAutoplay = err instanceof Error && err.name === "NotAllowedError";
        const msg = isAutoplay
          ? "Browser blocked autoplay — tap to start audio."
          : err instanceof Error
            ? err.message
            : String(err);
        appendLog({ level: "warn", source: "preview", message: msg });
        setError(msg);
        return false;
      }
    },
    [engine, deviceId, appendLog],
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

  return { status, engine, deviceId, error, log, play, pause, retry };
}
