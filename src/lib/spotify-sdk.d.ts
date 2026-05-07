// Minimal type shims for Spotify Web Playback SDK. Loaded as a global script.
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }

  interface SpotifyPlayer {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: "ready", cb: (e: { device_id: string }) => void): void;
    addListener(event: "not_ready", cb: (e: { device_id: string }) => void): void;
    addListener(
      event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
      cb: (e: { message: string }) => void,
    ): void;
    addListener(event: "player_state_changed", cb: (state: unknown) => void): void;
    pause(): Promise<void>;
    resume(): Promise<void>;
    setVolume(v: number): Promise<void>;
  }
}

export {};
