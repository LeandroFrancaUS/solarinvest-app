// src/pages/SignInPage.tsx
import { SignIn } from "@stack-auth/react";

export default function SignInPage() {
  return <SignIn fullPage={true} automaticRedirect={true} firstTab="password" />;
}
