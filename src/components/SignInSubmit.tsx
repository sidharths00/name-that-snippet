"use client";

import { useFormStatus } from "react-dom";

export function SignInSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:opacity-70"
    >
      {pending ? (
        <>
          <span className="spinner" />
          Redirecting…
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0Zm5.52 17.34a.75.75 0 0 1-1.03.25c-2.82-1.72-6.36-2.11-10.54-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.49-.59 11.65 1.34.36.22.47.69.25 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.99-8.16-2.56-11.98-1.4a.94.94 0 0 1-.55-1.79c4.37-1.33 9.81-.69 13.51 1.59.44.27.58.85.31 1.29Zm.13-3.4c-3.87-2.3-10.27-2.51-13.96-1.39a1.13 1.13 0 1 1-.66-2.16c4.24-1.29 11.28-1.04 15.74 1.6a1.13 1.13 0 1 1-1.12 1.95Z" />
          </svg>
          Continue with Spotify
        </>
      )}
    </button>
  );
}
