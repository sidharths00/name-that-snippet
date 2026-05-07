import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Spotify from "next-auth/providers/spotify";

const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-library-read",
  "streaming",
  "user-modify-playback-state",
  "user-read-playback-state",
  "user-read-currently-playing",
].join(" ");

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshAccessTokenError";
    user: {
      id: string;
      product?: "premium" | "free" | "open";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    spotifyId?: string;
    product?: "premium" | "free" | "open";
    error?: "RefreshAccessTokenError";
  }
}

// Reference the imported type so TS pulls the module into the program before
// applying the augmentation above.
type _AppJWT = JWT;

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

async function refreshSpotifyToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: ${res.status}`);
  }
  return (await res.json()) as SpotifyTokenResponse;
}

async function fetchSpotifyProduct(
  accessToken: string,
): Promise<"premium" | "free" | "open" | undefined> {
  try {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { product?: "premium" | "free" | "open" };
    return data.product;
  } catch {
    return undefined;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      authorization: { params: { scope: SPOTIFY_SCOPES } },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && account.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? undefined;
        const expiresAt =
          typeof account.expires_at === "number" ? account.expires_at * 1000 : null;
        token.accessTokenExpires = expiresAt ?? Date.now() + 3600 * 1000;
        const p = (profile ?? {}) as {
          id?: string;
          product?: "premium" | "free" | "open";
        };
        token.spotifyId = p.id ?? token.sub ?? undefined;
        token.product = p.product ?? (await fetchSpotifyProduct(account.access_token));
        return token;
      }

      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 60_000
      ) {
        return token;
      }

      if (!token.refreshToken) return token;

      try {
        const refreshed = await refreshSpotifyToken(token.refreshToken);
        token.accessToken = refreshed.access_token;
        token.accessTokenExpires = Date.now() + refreshed.expires_in * 1000;
        if (refreshed.refresh_token) token.refreshToken = refreshed.refresh_token;
        token.error = undefined;
      } catch (err) {
        console.error("[auth] refresh failed", err);
        token.error = "RefreshAccessTokenError";
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      if (session.user) {
        session.user.id = token.spotifyId ?? token.sub ?? "";
        session.user.product = token.product;
      }
      return session;
    },
  },
});
