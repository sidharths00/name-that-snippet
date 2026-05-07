import { auth } from "@/auth";

export interface SessionWithToken {
  userId: string;
  name: string;
  image: string | null;
  isPremium: boolean;
  accessToken: string;
}

export async function requireSpotifySession(): Promise<SessionWithToken | null> {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) return null;
  if (session.error === "RefreshAccessTokenError") return null;
  return {
    userId: session.user.id,
    name: session.user.name ?? "Player",
    image: session.user.image ?? null,
    isPremium: session.user.product === "premium",
    accessToken: session.accessToken,
  };
}
