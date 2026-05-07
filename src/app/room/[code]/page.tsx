import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getStore } from "@/lib/store";
import { publicRoom } from "@/lib/room";
import { RoomClient } from "./RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/?next=/room/${code}`);
  }
  const room = await getStore().getRoom(code.toUpperCase());
  if (!room) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-fg-muted">404</p>
          <h1 className="mt-2 text-3xl font-black">Room {code.toUpperCase()} not found</h1>
          <p className="mt-2 text-fg-muted">
            It may have ended, or the host hasn&apos;t created it yet.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg"
          >
            Back home
          </a>
        </div>
      </main>
    );
  }

  // Auto-join if the user opened a /room/[code] link directly without going
  // through the join form. They still need a valid session.
  const initial = publicRoom(room, session.user.id);
  return (
    <RoomClient
      initialRoom={initial}
      viewer={{
        id: session.user.id,
        name: session.user.name ?? "Player",
        image: session.user.image ?? null,
        isPremium: session.user.product === "premium",
      }}
    />
  );
}
