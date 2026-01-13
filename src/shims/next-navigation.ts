export type NavigateOptions = {
  scroll?: boolean
}

export type AppRouterInstance = {
  push: (href: string, options?: NavigateOptions) => void
  replace: (href: string, options?: NavigateOptions) => void
  refresh: () => void
  back: () => void
  forward: () => void
  prefetch: (href: string) => void
}

export const redirect = (url: string) => {
  if (typeof window !== 'undefined') {
    window.location.assign(url)
  }
}

export const notFound = () => {
  if (typeof window !== 'undefined') {
    window.location.assign('/404')
  }
}

export const useRouter = (): AppRouterInstance => ({
  push: (href: string) => {
    if (typeof window !== 'undefined') {
      window.location.assign(href)
    }
  },
  replace: (href: string) => {
    if (typeof window !== 'undefined') {
      window.location.replace(href)
    }
  },
  refresh: () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  },
  back: () => {
    if (typeof window !== 'undefined') {
      window.history.back()
    }
  },
  forward: () => {
    if (typeof window !== 'undefined') {
      window.history.forward()
    }
  },
  prefetch: () => undefined,
})

export const usePathname = () => (typeof window === 'undefined' ? '' : window.location.pathname)
export const useSearchParams = () =>
  typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
