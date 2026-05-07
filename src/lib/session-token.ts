import { auth } from "@/auth";

export interface SessionWithToken {
  userId: string;
  name: string;
  image: string | null;
  isPremium: boolean;
  accessToken: string;
}

export type SessionFailureReason = "not-signed-in" | "session-expired";

export async function requireSpotifySession(): Promise<
  | { ok: true; session: SessionWithToken }
  | { ok: false; reason: SessionFailureReason }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "not-signed-in" };
  if (session.error === "RefreshAccessTokenError" || !session.accessToken) {
    return { ok: false, reason: "session-expired" };
  }
  return {
    ok: true,
    session: {
      userId: session.user.id,
      name: session.user.name ?? "Player",
      image: session.user.image ?? null,
      isPremium: session.user.product === "premium",
      accessToken: session.accessToken,
    },
  };
}
