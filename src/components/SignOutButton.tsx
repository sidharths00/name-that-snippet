import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="text-xs font-medium text-fg-muted transition hover:text-fg"
      >
        Sign out
      </button>
    </form>
  );
}
