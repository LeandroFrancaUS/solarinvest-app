export function markFogNodes() {
  // cria um estilo para destacar em vermelho
  const styleId = 'fog-detector-style'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `[data-fog="1"]{ outline: 2px solid red !important; outline-offset: -1px !important; }`
    document.head.appendChild(style)
  }

  // limpa marcas antigas
  document.querySelectorAll('[data-fog="1"]').forEach((n) => n.removeAttribute('data-fog'))

  const all = document.querySelectorAll<HTMLElement>('*')
  all.forEach((el) => {
    const cs = getComputedStyle(el)
    const fog =
      cs.filter.includes('blur') ||
      cs.backdropFilter !== 'none' ||
      (cs as any).webkitBackdropFilter?.toString?.() !== 'none' ||
      (parseFloat(cs.opacity) < 0.98 && el !== document.body && el !== document.documentElement)

    if (fog) {
      el.setAttribute('data-fog', '1')
    }
  })
}

export function logFogCandidates() {
  const arr: HTMLElement[] = []
  document.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const cs = getComputedStyle(el)
    const fog =
      cs.filter.includes('blur') ||
      cs.backdropFilter !== 'none' ||
      (cs as any).webkitBackdropFilter?.toString?.() !== 'none' ||
      parseFloat(cs.opacity) < 0.98

    if (fog) arr.push(el)
  })
  console.group('[fog] candidatos')
  arr.forEach((el, i) => {
    console.log(`#${i}`, el, getComputedStyle(el).cssText)
  })
  console.groupEnd()
}
