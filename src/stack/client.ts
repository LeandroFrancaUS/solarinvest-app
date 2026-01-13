// src/stack/client.ts
import { StackClientApp } from '@stack-auth/react'

const projectId = import.meta.env.VITE_STACK_PROJECT_ID
const publishableClientKey = import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY

if (!projectId || !publishableClientKey) {
  // Isso ajuda MUITO a não ficar “silencioso” quando env não chega
  console.warn('[stack] Missing VITE_STACK_PROJECT_ID or VITE_STACK_PUBLISHABLE_CLIENT_KEY')
}

export const stackClientApp = new StackClientApp({
  projectId,
  publishableClientKey,
})
