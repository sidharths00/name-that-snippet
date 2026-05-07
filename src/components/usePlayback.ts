"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

export type PlaybackStatus = "idle" | "loading" | "ready" | "error";

interface UsePlaybackOptions {
  enabled: boolean;
  name: string;
}

interface UsePlaybackResult {
  status: PlaybackStatus;
  deviceId: string | null;
  error: string | null;
  play: (uri: string, positionMs?: number) => Promise<void>;
  pause: () => Promise<void>;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("/api/spotify/token", { cache: "no-store" });
  if (!res.ok) throw new Error("Couldn't load Spotify token");
  const { accessToken } = (await res.json()) as { accessToken: string };
  return accessToken;
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
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        await loadSdk();
        if (cancelled) return;

        const player = new window.Spotify!.Player({
          name,
          getOAuthToken: (cb) => {
            // refresh on every request — Auth.js handles caching
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
          setDeviceId(device_id);
          setStatus("ready");
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
            setError(`${evt}: ${message}`);
            setStatus("error");
          });
        }

        const ok = await player.connect();
        if (!ok && !cancelled) {
          setStatus("error");
          setError("Couldn't connect to Spotify Connect");
        }
        playerRef.current = player;
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Playback error");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [enabled, name]);

  const play = useCallback(async (uri: string, positionMs = 0) => {
    if (!deviceId) throw new Error("Player not ready");
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
        body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
      },
    );
    if (!res.ok && res.status !== 204) {
      throw new Error(`Spotify play ${res.status}`);
    }
  }, [deviceId]);

  const pause = useCallback(async () => {
    await playerRef.current?.pause();
  }, []);

  return { status, deviceId, error, play, pause };
}
