// Thin Spotify Web API helpers used by server routes.

interface SpotifyArtist {
  name: string;
}

interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: SpotifyArtist[];
  duration_ms: number;
  preview_url: string | null;
}

interface PaginatedTracks {
  items: SpotifyTrack[];
  next: string | null;
}

interface SavedTrackItem {
  track: SpotifyTrack;
}

interface PaginatedSavedTracks {
  items: SavedTrackItem[];
  next: string | null;
}

async function spotify<T>(token: string, path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `https://api.spotify.com/v1${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify ${res.status}: ${body || path}`);
  }
  return (await res.json()) as T;
}

export interface SimpleTrack {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  durationMs: number;
  previewUrl: string | null;
}

function toSimple(t: SpotifyTrack): SimpleTrack {
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    artists: t.artists.map((a) => a.name),
    durationMs: t.duration_ms,
    previewUrl: t.preview_url,
  };
}

export async function getTopTracks(token: string, timeRange: "short_term" | "medium_term" | "long_term" = "medium_term"): Promise<SimpleTrack[]> {
  const data = await spotify<PaginatedTracks>(
    token,
    `/me/top/tracks?limit=50&time_range=${timeRange}`
  );
  return data.items.map(toSimple);
}

export async function getSavedTracks(token: string, max = 200): Promise<SimpleTrack[]> {
  const tracks: SimpleTrack[] = [];
  let url: string | null = "/me/tracks?limit=50";
  while (url && tracks.length < max) {
    const data: PaginatedSavedTracks = await spotify<PaginatedSavedTracks>(token, url);
    for (const item of data.items) tracks.push(toSimple(item.track));
    url = data.next;
  }
  return tracks.slice(0, max);
}

export async function getUserLibrarySample(token: string): Promise<SimpleTrack[]> {
  const [topMedium, topShort, saved] = await Promise.all([
    getTopTracks(token, "medium_term").catch(() => []),
    getTopTracks(token, "short_term").catch(() => []),
    getSavedTracks(token, 100).catch(() => []),
  ]);
  const seen = new Map<string, SimpleTrack>();
  for (const t of [...topMedium, ...topShort, ...saved]) {
    if (!seen.has(t.id)) seen.set(t.id, t);
  }
  return Array.from(seen.values());
}

export async function transferPlayback(token: string, deviceId: string, play = false) {
  const res = await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify transfer playback ${res.status}`);
  }
}

export async function playTrackOnDevice(
  token: string,
  deviceId: string,
  trackUri: string,
  positionMs = 0,
) {
  const res = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [trackUri], position_ms: positionMs }),
    },
  );
  if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify play ${res.status}`);
  }
}

export async function pausePlayback(token: string, deviceId?: string) {
  const url = deviceId
    ? `https://api.spotify.com/v1/me/player/pause?device_id=${encodeURIComponent(deviceId)}`
    : "https://api.spotify.com/v1/me/player/pause";
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204 && res.status !== 404) {
    throw new Error(`Spotify pause ${res.status}`);
  }
}
