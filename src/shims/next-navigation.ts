type NavigateHandler = (url: string) => void

const ensureBrowser = () => {
  if (typeof window === 'undefined') {
    throw new Error('next/navigation shim used outside the browser.')
  }
}

const navigate: NavigateHandler = (url) => {
  ensureBrowser()
  window.location.assign(url)
}

export const RedirectType = {
  replace: 'replace',
  push: 'push',
} as const

export type RedirectType = (typeof RedirectType)[keyof typeof RedirectType]

export const redirect = (url: string) => {
  navigate(url)
}

export const notFound = () => {
  const error = new Error('next/navigation notFound() was called.')
  ;(error as Error & { digest?: string }).digest = 'NEXT_NOT_FOUND'
  throw error
}

export const useRouter = () => ({
  push: navigate,
  replace: (url: string) => {
    ensureBrowser()
    window.location.replace(url)
  },
  back: () => {
    ensureBrowser()
    window.history.back()
  },
  forward: () => {
    ensureBrowser()
    window.history.forward()
  },
  prefetch: async () => undefined,
})

export const usePathname = () => {
  ensureBrowser()
  return window.location.pathname
}

export const useSearchParams = () => {
  ensureBrowser()
  return new URLSearchParams(window.location.search)
}
