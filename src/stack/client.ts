// src/stack/client.ts
import { StackClientApp } from "@stackframe/stack"

const projectId = import.meta.env.VITE_STACK_PROJECT_ID
const publishableClientKey = import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY

if (!projectId || !publishableClientKey) {
  console.warn("[stack] Missing VITE_STACK_PROJECT_ID or VITE_STACK_PUBLISHABLE_CLIENT_KEY")
}

export const stackClientApp = new StackClientApp({
  projectId,
  publishableClientKey,
})
