import { useRef, useEffect } from 'react'
import { audioValues, getDebugData, KICK_LO_HZ, KICK_HI_HZ, SNARE_LO_HZ, SNARE_HI_HZ } from '../audio/AudioAnalyser'

/** Map a linear frequency (Hz) to a log-scaled X position on the canvas */
function freqToX(freq: number, width: number, minFreq: number, maxFreq: number): number {
  const logMin = Math.log10(minFreq)
  const logMax = Math.log10(maxFreq)
  return ((Math.log10(freq) - logMin) / (logMax - logMin)) * width
}

export default function DebugOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)

      const { freqData, sampleRate, fftSize } = getDebugData()
      if (!freqData) return

      const w = canvas!.width
      const h = canvas!.height
      const binCount = freqData.length
      const binHz = sampleRate / fftSize
      const minFreq = 20
      const maxFreq = sampleRate / 2

      ctx.clearRect(0, 0, w, h)

      // Semi-transparent background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, w, h)

      const spectrumTop = 60
      const spectrumH = h - spectrumTop - 40
      const dbMin = -100
      const dbMax = 0

      // --- Band highlight regions ---
      const kickX0 = freqToX(KICK_LO_HZ, w, minFreq, maxFreq)
      const kickX1 = freqToX(KICK_HI_HZ, w, minFreq, maxFreq)
      ctx.fillStyle = 'rgba(0, 255, 255, 0.08)'
      ctx.fillRect(kickX0, spectrumTop, kickX1 - kickX0, spectrumH)

      const snareX0 = freqToX(SNARE_LO_HZ, w, minFreq, maxFreq)
      const snareX1 = freqToX(SNARE_HI_HZ, w, minFreq, maxFreq)
      ctx.fillStyle = 'rgba(255, 0, 127, 0.08)'
      ctx.fillRect(snareX0, spectrumTop, snareX1 - snareX0, spectrumH)

      const fmtHz = (hz: number) => hz >= 1000 ? `${hz / 1000}k` : `${hz}`

      // Band labels
      ctx.font = '11px monospace'
      ctx.fillStyle = '#0ff'
      ctx.fillText(`KICK ${fmtHz(KICK_LO_HZ)}-${fmtHz(KICK_HI_HZ)}Hz`, kickX0 + 4, spectrumTop + 14)
      ctx.fillStyle = '#ff007f'
      ctx.fillText(`SNARE ${fmtHz(SNARE_LO_HZ)}-${fmtHz(SNARE_HI_HZ)}Hz`, snareX0 + 4, spectrumTop + 14)

      // --- Spectrum bars ---
      let peakDb = -Infinity
      let peakFreq = 0

      for (let i = 1; i < binCount; i++) {
        const freq = i * binHz
        if (freq < minFreq) continue

        const db = freqData[i]
        if (db > peakDb) {
          peakDb = db
          peakFreq = freq
        }

        const x = freqToX(freq, w, minFreq, maxFreq)
        const nextX = freqToX(freq + binHz, w, minFreq, maxFreq)
        const barW = Math.max(1, nextX - x - 0.5)

        const norm = Math.max(0, (db - dbMin) / (dbMax - dbMin))
        const barH = norm * spectrumH

        // Color based on band
        if (freq >= KICK_LO_HZ && freq <= KICK_HI_HZ) {
          ctx.fillStyle = `rgba(0, 255, 255, ${0.4 + norm * 0.6})`
        } else if (freq >= SNARE_LO_HZ && freq <= SNARE_HI_HZ) {
          ctx.fillStyle = `rgba(255, 0, 127, ${0.4 + norm * 0.6})`
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + norm * 0.5})`
        }

        ctx.fillRect(x, spectrumTop + spectrumH - barH, barW, barH)
      }

      // --- Frequency axis labels ---
      ctx.fillStyle = '#666'
      ctx.font = '10px monospace'
      for (const f of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
        if (f > maxFreq) continue
        const x = freqToX(f, w, minFreq, maxFreq)
        ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x, spectrumTop + spectrumH + 14)
        ctx.fillRect(x, spectrumTop + spectrumH, 1, 6)
      }

      // --- Intensity meters (top bar) ---
      const meterH = 16
      const meterY = 10
      const meterW = w / 2 - 80

      // Kick meter
      ctx.fillStyle = '#222'
      ctx.fillRect(60, meterY, meterW, meterH)
      ctx.fillStyle = '#0ff'
      ctx.fillRect(60, meterY, meterW * audioValues.kickIntensity, meterH)
      ctx.fillStyle = '#0ff'
      ctx.font = '13px monospace'
      ctx.fillText('KICK', 10, meterY + 13)
      ctx.fillText(audioValues.kickIntensity.toFixed(3), 60 + meterW + 8, meterY + 13)

      // Snare meter
      const snareBarX = w / 2 + 40
      ctx.fillStyle = '#222'
      ctx.fillRect(snareBarX + 60, meterY, meterW, meterH)
      ctx.fillStyle = '#ff007f'
      ctx.fillRect(snareBarX + 60, meterY, meterW * audioValues.snareIntensity, meterH)
      ctx.fillStyle = '#ff007f'
      ctx.fillText('SNARE', snareBarX, meterY + 13)
      ctx.fillText(audioValues.snareIntensity.toFixed(3), snareBarX + 60 + meterW + 8, meterY + 13)

      // --- Info text (bottom-left) ---
      ctx.fillStyle = '#555'
      ctx.font = '11px monospace'
      const infoY = h - 16
      ctx.fillText(
        `SR: ${sampleRate}Hz | Bins: ${binCount} | ${binHz.toFixed(1)}Hz/bin | Peak: ${peakFreq.toFixed(0)}Hz (${peakDb.toFixed(1)}dB)`,
        10,
        infoY,
      )

      // Toggle hint
      ctx.fillStyle = '#444'
      ctx.fillText('Press D to close', w - 130, infoY)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  )
}
