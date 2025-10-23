const OVERLAY_SELECTORS = [
  '.overlay',
  '.backdrop',
  '.frosted',
  '.frosted-overlay',
  '.glass',
  '.glass-overlay',
  '.page-dim',
  '.dim-layer',
  '.modal-backdrop',
  '.snow-overlay',
]

const ROOT_SELECTORS = ['html', 'body', '#root', '.app']

export function removeGlobalOverlays(): void {
  if (typeof document === 'undefined') {
    return
  }

  OVERLAY_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.remove()
    })
  })

  ROOT_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (element instanceof HTMLElement || element instanceof HTMLHtmlElement) {
        const target = element as HTMLElement
        target.style.opacity = '1'
        target.style.filter = 'none'
        target.style.backdropFilter = 'none'
        target.style.mixBlendMode = 'normal'
      }
    })
  })
}
