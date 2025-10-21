import React from 'react'
import { createRoot, type Root } from 'react-dom/client'

type ActiveRoot = {
  container: HTMLElement
  root: Root
}

const activeRoots = new Set<ActiveRoot>()

export type RenderResult = {
  container: HTMLElement
  unmount: () => void
  rerender: (ui: React.ReactElement) => void
}

const attachContainer = (): HTMLElement => {
  const container = document.createElement('div')
  if (document.body) {
    document.body.appendChild(container)
  }
  return container
}

export const cleanup = (): void => {
  activeRoots.forEach((entry) => {
    const { root, container } = entry
    try {
      root.unmount()
    } finally {
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }
  })
  activeRoots.clear()
}

export const render = (ui: React.ReactElement): RenderResult => {
  const container = attachContainer()
  const root = createRoot(container)
  const entry: ActiveRoot = { container, root }
  activeRoots.add(entry)
  root.render(ui)

  return {
    container,
    unmount: () => {
      if (activeRoots.has(entry)) {
        activeRoots.delete(entry)
      }
      root.unmount()
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    },
    rerender: (nextUi) => {
      root.render(nextUi)
    },
  }
}
