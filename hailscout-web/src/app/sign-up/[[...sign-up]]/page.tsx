import { redirect } from "next/navigation";

// Sign-in and sign-up are the same action here (OAuth / work account), so we
// keep ONE auth page. /sign-up now redirects to it — old links still work.
export default function SignUpPage() {
  redirect("/sign-in");
}
