import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "@/components/Logo";
import { CreateRoomForm } from "./CreateRoomForm";

export default async function HostPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  return (
    <main className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/" className="text-xs text-fg-muted hover:text-fg">
          ← Cancel
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16 sm:px-10">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Set up your room</h1>
        <p className="mt-2 text-sm text-fg-muted">
          You&apos;ll get a 4-letter code to share. Friends sign in with their own
          Spotify so we can pull songs you all know.
        </p>
        <div className="mt-8">
          <CreateRoomForm />
        </div>
      </section>
    </main>
  );
}
