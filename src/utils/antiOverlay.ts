const OVERLAY_SELECTORS = [
  '.overlay',
  '.backdrop',
  '.frost',
  '.frosted',
  '.frosted-overlay',
  '.glass',
  '.glass-overlay',
  '.page-dim',
  '.dim-layer',
  '.modal-backdrop',
  '.snow-overlay',
  '[class*="overlay"]',
  '[class*="backdrop"]',
  '[class*="frost"]',
  '[class*="glass"]',
  '[class*="dim"]',
]

const STYLE_BASED_SELECTORS = [
  '*[style*="backdrop-filter" i]',
  '*[style*="-webkit-backdrop-filter" i]',
  '*[style*="filter" i]',
  '*[style*="opacity" i]',
  '*[style*="mix-blend-mode" i]',
  '*[style*="mask" i]',
  '*[style*="-webkit-mask" i]',
  '[class*="blur" i]',
  '[class*="filtro" i]',
]

const CANDIDATE_SELECTORS = Array.from(new Set([...OVERLAY_SELECTORS, ...STYLE_BASED_SELECTORS]))

const ROOT_ELEMENTS = [
  'html',
  'body',
  '#root',
  '.app',
  '.layout',
  '.page',
  'main',
  '[class*="page"]',
  '[class*="layout"]',
]
const NEUTRALIZE_QUERY = OVERLAY_SELECTORS.join(', ')
const CANDIDATE_QUERY = CANDIDATE_SELECTORS.join(', ')
const COVERAGE_THRESHOLD = 0.98

type IdleCallback = (deadline: IdleDeadline) => void

interface IdleDeadline {
  readonly didTimeout: boolean
  timeRemaining(): number
}

type IdleScheduler = (callback: () => void) => void

function createIdleScheduler(): IdleScheduler {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const anyWindow = window as typeof window & {
    requestIdleCallback?: (callback: IdleCallback) => number
  }

  if (typeof anyWindow.requestIdleCallback === 'function') {
    return (callback) => {
      anyWindow.requestIdleCallback?.(() => callback())
    }
  }

  return (callback) => {
    window.setTimeout(callback, 16)
  }
}

const scheduleIdle = createIdleScheduler()

function scheduleNeutralization(nodes: Iterable<Element>): void {
  if (typeof document === 'undefined') {
    return
  }

  const uniqueNodes: HTMLElement[] = []
  const seen = new Set<HTMLElement>()

  for (const node of nodes) {
    if (node instanceof HTMLElement && !seen.has(node)) {
      seen.add(node)
      uniqueNodes.push(node)
    }
  }

  if (uniqueNodes.length === 0) {
    return
  }

  const BATCH_SIZE = 40

  const processBatch = (startIndex: number) => {
    const endIndex = Math.min(startIndex + BATCH_SIZE, uniqueNodes.length)
    for (let index = startIndex; index < endIndex; index += 1) {
      neutralizeNode(uniqueNodes[index])
    }

    if (endIndex < uniqueNodes.length) {
      scheduleIdle(() => processBatch(endIndex))
    }
  }

  processBatch(0)
}

function collectCandidatesFromNode(node: Element): Element[] {
  if (!CANDIDATE_QUERY) {
    return []
  }

  const candidates: Element[] = []

  if (node.matches?.(CANDIDATE_QUERY)) {
    candidates.push(node)
  }

  node.querySelectorAll?.(CANDIDATE_QUERY).forEach((element) => {
    candidates.push(element)
  })

  return candidates
}

function hideOverlayElement(element: HTMLElement) {
  element.style.display = 'none'
  element.style.visibility = 'hidden'
  element.style.pointerEvents = 'none'
}

function resetElementFog(element: HTMLElement) {
  element.style.filter = 'none'
  element.style.setProperty('backdrop-filter', 'none')
  element.style.setProperty('-webkit-backdrop-filter', 'none')
  element.style.opacity = '1'
  element.style.mixBlendMode = 'normal'
  element.style.pointerEvents = 'auto'
  element.style.setProperty('mask-image', 'none')
  element.style.setProperty('-webkit-mask-image', 'none')
}

export function neutralizeNode(node: Element): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  if (!(node instanceof HTMLElement)) {
    return
  }

  if (NEUTRALIZE_QUERY && node.matches?.(NEUTRALIZE_QUERY)) {
    hideOverlayElement(node)
  }

  if (NEUTRALIZE_QUERY) {
    node.querySelectorAll(NEUTRALIZE_QUERY).forEach((element) => {
      if (element instanceof HTMLElement) {
        hideOverlayElement(element)
      }
    })
  }

  const styles = window.getComputedStyle(node)
  const backdropFilter = styles.getPropertyValue('backdrop-filter')
  const webkitBackdropFilter = styles.getPropertyValue('-webkit-backdrop-filter')
  const filterValue = styles.filter ?? ''
  const filterHasFog =
    filterValue &&
    filterValue !== 'none' &&
    (filterValue.includes('blur') || filterValue.includes('brightness'))
  const hasFog =
    (backdropFilter && backdropFilter !== 'none') ||
    (webkitBackdropFilter && webkitBackdropFilter !== 'none') ||
    filterHasFog ||
    styles.opacity !== '1'

  if (!hasFog) {
    return
  }

  const isFixedOrAbsolute =
    (styles.position === 'fixed' || styles.position === 'absolute') && styles.zIndex !== 'auto'
  const inset = styles.inset
  const isInsetFull = inset === '0px'
  const isEdgeToEdge =
    styles.top === '0px' &&
    styles.left === '0px' &&
    styles.right === '0px' &&
    styles.bottom === '0px'

  const coversViewport =
    node.offsetWidth >= window.innerWidth * COVERAGE_THRESHOLD &&
    node.offsetHeight >= window.innerHeight * COVERAGE_THRESHOLD

  if (isFixedOrAbsolute || isInsetFull || isEdgeToEdge || coversViewport) {
    resetElementFog(node)
  }
}

export function removeFogOverlays(): void {
  if (typeof document === 'undefined') {
    return
  }

  if (CANDIDATE_QUERY) {
    const candidates = document.querySelectorAll(CANDIDATE_QUERY)
    scheduleNeutralization(Array.from(candidates))
  }

  ROOT_ELEMENTS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (element instanceof HTMLElement) {
        resetElementFog(element)
      }
    })
  })
}

export function watchFogReinjection(): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {}
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            scheduleNeutralization(collectCandidatesFromNode(node))
          }
        })
      }

      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        if (!CANDIDATE_QUERY || mutation.target.matches(CANDIDATE_QUERY)) {
          scheduleNeutralization([mutation.target])
        }
      }
    }
  })

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  })

  return () => observer.disconnect()
}

export function removeGlobalOverlays(): void {
  removeFogOverlays()
}
