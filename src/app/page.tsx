import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/Logo";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { JoinRoomForm } from "./_components/JoinRoomForm";
import { SoloButton } from "./_components/SoloButton";

export default async function HomePage() {
  const session = await auth();
  const signedIn = !!session?.user;

  return (
    <main className="relative flex min-h-screen flex-col">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(800px circle at 20% 0%, rgba(30,215,96,0.18), transparent 50%), radial-gradient(600px circle at 90% 30%, rgba(120,80,255,0.12), transparent 50%)",
        }}
      />

      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        {signedIn ? (
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-fg-muted sm:inline">
              {session.user?.name}
              {session.user?.product === "premium" && (
                <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  PREMIUM
                </span>
              )}
            </span>
            <SignOutButton />
          </div>
        ) : null}
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-12 px-6 pb-16 pt-8 sm:px-10">
        <div className="space-y-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            the music guessing game
          </p>
          <h1 className="text-balance text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
            Race to name
            <br />
            the song.
          </h1>
          <p className="mx-auto max-w-xl text-balance text-base text-fg-muted sm:text-lg">
            Pull songs from your shared libraries and battle your friends to
            guess title and artist first. IRL on a speaker, or remote on every phone.
          </p>
        </div>

        {!signedIn ? (
          <div className="flex flex-col items-center gap-3">
            <SignInButton callbackUrl="/" />
            <p className="max-w-md text-center text-xs text-fg-muted">
              Spotify Premium recommended for in-app playback. Free accounts can still
              play in &ldquo;host plays on speaker&rdquo; mode.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-3xl space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/host"
                className="group relative overflow-hidden rounded-2xl border border-border bg-bg-elev p-6 transition hover:border-accent/60"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Host a room</h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      Pick a mode, share the code with friends.
                    </p>
                  </div>
                  <span className="text-2xl">🎙</span>
                </div>
                <span className="mt-6 inline-flex h-10 items-center rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg transition group-hover:bg-accent-hover">
                  Create room →
                </span>
              </Link>

              <div className="rounded-2xl border border-border bg-bg-elev p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Join a room</h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      Got a 4-letter code? Drop it in.
                    </p>
                  </div>
                  <span className="text-2xl">🎧</span>
                </div>
                <div className="mt-6">
                  <JoinRoomForm />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-bg-elev/60 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold">Just yourself?</p>
                  <p className="text-xs text-fg-muted">
                    Solo mode. We pull from your library and you race the clock.
                  </p>
                </div>
                <SoloButton />
              </div>
            </div>
          </div>
        )}

        <div className="grid w-full max-w-3xl gap-3 text-sm sm:grid-cols-3">
          <Feature title="Shared library" body="We mash up everyone's top tracks and saved songs." />
          <Feature title="Two modes" body="Race to type the answer, or take turns face-to-face." />
          <Feature title="IRL or remote" body="Play on a speaker together, or sync to every device." />
        </div>
      </section>

      <footer className="flex flex-col items-center gap-1 px-6 py-6 text-center text-xs text-fg-muted sm:px-10">
        <span className="inline-flex items-center gap-1.5">
          Powered by
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0Zm5.52 17.34a.75.75 0 0 1-1.03.25c-2.82-1.72-6.36-2.11-10.54-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.49-.59 11.65 1.34.36.22.47.69.25 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.99-8.16-2.56-11.98-1.4a.94.94 0 0 1-.55-1.79c4.37-1.33 9.81-.69 13.51 1.59.44.27.58.85.31 1.29Zm.13-3.4c-3.87-2.3-10.27-2.51-13.96-1.39a1.13 1.13 0 1 1-.66-2.16c4.24-1.29 11.28-1.04 15.74 1.6a1.13 1.13 0 1 1-1.12 1.95Z" />
          </svg>
          Spotify
        </span>
        <span>Not affiliated with or endorsed by Spotify AB.</span>
      </footer>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elev/60 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-fg-muted">{body}</p>
    </div>
  );
}
