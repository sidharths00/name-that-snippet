import Link from "next/link";
import { Logo } from "@/components/Logo";

const KNOWN: Record<string, { title: string; body: React.ReactNode }> = {
  Configuration: {
    title: "Spotify rejected the sign-in",
    body: (
      <>
        <p>
          The most common cause: your Spotify account isn&apos;t on the app&apos;s
          allowlist. The host needs to add your account email + display name in
          their Spotify Developer Dashboard → User Management.
        </p>
        <p className="mt-3 text-fg-muted">
          To find the email Spotify uses for you: open Spotify → Settings →
          Account. The email there is what the host should add — exactly as
          shown.
        </p>
      </>
    ),
  },
  AccessDenied: {
    title: "Sign-in cancelled",
    body: (
      <p>
        Looks like you didn&apos;t grant the requested permissions. We need
        access to your Spotify library to build the song pool — without it,
        the game can&apos;t pick what you know.
      </p>
    ),
  },
  Verification: {
    title: "Sign-in link expired",
    body: <p>Your verification link expired. Try signing in again.</p>,
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const known = error ? KNOWN[error] : undefined;
  return (
    <main className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-6 pb-16 sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-danger">
          Sign-in error
        </p>
        <h1 className="text-balance text-3xl font-black leading-tight sm:text-4xl">
          {known?.title ?? "Something went wrong signing in"}
        </h1>
        <div className="space-y-3 text-sm text-fg leading-relaxed">
          {known?.body ?? (
            <p className="text-fg-muted">
              Spotify returned an unexpected response. Try again, or check that
              your account is on the host&apos;s allowlist.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
          >
            Back to home
          </Link>
          <a
            href="https://www.spotify.com/account/profile/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-bg-elev px-5 text-sm font-semibold text-fg transition hover:border-fg-muted"
          >
            Find my Spotify email →
          </a>
        </div>
        {error && (
          <p className="pt-4 font-mono text-[10px] text-fg-muted">
            error code: {error}
          </p>
        )}
      </section>
    </main>
  );
}
