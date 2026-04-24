type SoundType = 'alert' | 'success' | 'error'

const FREQUENCIES: Record<SoundType, number[]> = {
  alert: [880, 660],
  success: [523, 659, 784],
  error: [400, 300],
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    } catch {
      return null
    }
  }
  return audioCtx
}

export function playNotificationSound(type: SoundType = 'alert'): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const freqs = FREQUENCIES[type]
  let startTime = ctx.currentTime

  for (const freq of freqs) {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(freq, startTime)
    gainNode.gain.setValueAtTime(0.3, startTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15)

    oscillator.start(startTime)
    oscillator.stop(startTime + 0.15)
    startTime += 0.15
  }
}
