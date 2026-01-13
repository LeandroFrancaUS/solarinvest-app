// src/pages/SignInPage.tsx
import { SignIn } from "@stackframe/stack";

export default function SignInPage() {
  return <SignIn fullPage={true} automaticRedirect={true} firstTab="password" />;
}
