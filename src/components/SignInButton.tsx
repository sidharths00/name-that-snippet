import { signIn } from "@/auth";
import { SignInSubmit } from "./SignInSubmit";

export function SignInButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("spotify", { redirectTo: callbackUrl });
      }}
    >
      <SignInSubmit />
    </form>
  );
}
