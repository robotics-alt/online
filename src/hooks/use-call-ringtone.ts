'use client'
import { useEffect } from 'react'

let sharedContext: AudioContext | null = null
export function primeCallAudio() {
  if (typeof window === 'undefined') return
  try { sharedContext ||= new AudioContext(); void sharedContext.resume().catch(() => {}) } catch { /* the browser may require another tap */ }
}

/** Ring only after a browser has permitted audio; stop every tone on answer/end/unmount. */
export function useCallRingtone(active: boolean, deadline?: string, outgoing = false) {
  useEffect(() => {
    const unlock = primeCallAudio
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  }, [])
  useEffect(() => {
    if (!active) return
    let stopped = false
    const oscillators = new Set<OscillatorNode>()
    const ring = () => {
      if (stopped || deadline && Date.now() >= Date.parse(deadline)) return
      primeCallAudio()
      const audio = sharedContext
      if (!audio) return
      if (audio.state !== 'running') { void audio.resume().catch(() => {}); return }
      for (const offset of [0, .85]) {
        const oscillator = audio.createOscillator(); const gain = audio.createGain()
        oscillator.connect(gain); gain.connect(audio.destination)
        const start = audio.currentTime + offset
        oscillator.frequency.setValueAtTime(outgoing ? 440 : 660, start)
        oscillator.frequency.setValueAtTime(outgoing ? 480 : 880, start + .2)
        gain.gain.setValueAtTime(.001, start); gain.gain.exponentialRampToValueAtTime(.045, start + .025); gain.gain.exponentialRampToValueAtTime(.001, start + .55)
        oscillators.add(oscillator); oscillator.start(start); oscillator.stop(start + .6)
        oscillator.onended = () => { oscillators.delete(oscillator); oscillator.disconnect(); gain.disconnect() }
      }
    }
    ring(); const timer = window.setInterval(ring, 3000)
    return () => { stopped = true; window.clearInterval(timer); for (const oscillator of oscillators) { try { oscillator.stop() } catch {} }; oscillators.clear() }
  }, [active, deadline, outgoing])
}
