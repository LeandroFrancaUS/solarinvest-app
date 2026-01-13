// src/stack/client.ts
import { StackClientApp } from '@stackframe/stack'

const projectId = import.meta.env.VITE_STACK_PROJECT_ID
const publishableClientKey = import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY

export const isStackConfigured = Boolean(projectId && publishableClientKey)

if (!isStackConfigured) {
  // Isso ajuda MUITO a não ficar “silencioso” quando env não chega
  console.warn('[stack] Missing VITE_STACK_PROJECT_ID or VITE_STACK_PUBLISHABLE_CLIENT_KEY')
}

let stackClientApp: StackClientApp | null = null

export const getStackClientApp = (): StackClientApp | null => {
  if (!isStackConfigured || typeof window === 'undefined') {
    return null
  }

  if (!stackClientApp) {
    stackClientApp = new StackClientApp({
      projectId,
      publishableClientKey,
    })
  }

  return stackClientApp
}
