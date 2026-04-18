import { Canvas, useThree } from '@react-three/fiber'
import { ReactNode, useEffect, useState } from 'react'
import DrumParticles from './DrumParticles'
import FFTMorph, {
  CAPTURE_DURATION,
  CAMERA_ZOOM,
  CONTENT_HALF_HEIGHT,
  RIBBON_W,
  TOP_CENTER,
  WAVE_TARGET,
  SPEC_BASELINE,
} from './FFTMorph'
import { isOverlayMode, getSceneParam } from '../overlay'
import { useCaptureStore } from '../stores/useCaptureStore'
import { getDisplayInfo } from '../audio/AudioAnalyser'

function FitToViewport({ children }: { children: ReactNode }) {
  const { viewport } = useThree()
  const s = Math.min(
    viewport.width / RIBBON_W,
    viewport.height / (2 * CONTENT_HALF_HEIGHT),
  )
  return <group scale={[s, s, 1]}>{children}</group>
}

const FREQ_TICKS = [
  { hz: 100, label: '100Hz' },
  { hz: 1000, label: '1kHz' },
  { hz: 10000, label: '10kHz' },
]
const HZ_LOW = 40
const HZ_HIGH = 20000
const FREQ_LOG_RANGE = Math.log(HZ_HIGH / HZ_LOW)

const TIME_TICK_CANDIDATES = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

function pickTimeTicks(windowMs: number): number[] {
  for (const step of TIME_TICK_CANDIDATES) {
    const count = Math.floor(windowMs / step)
    if (count >= 2 && count <= 5) {
      return Array.from({ length: count }, (_, i) => (i + 1) * step).filter((m) => m < windowMs)
    }
  }
  return [Math.floor(windowMs / 2)]
}

/**
 * World-to-pixel layout. Scale matches FitToViewport so DOM labels line up with the ribbon.
 */
function computeLayout(w: number, h: number) {
  const viewportW = w / CAMERA_ZOOM
  const viewportH = h / CAMERA_ZOOM
  const scale = Math.min(viewportW / RIBBON_W, viewportH / (2 * CONTENT_HALF_HEIGHT))
  const pxPerWorld = scale * CAMERA_ZOOM
  const worldToPy = (wy: number) => h / 2 - wy * pxPerWorld
  return {
    ribbonWidthPx: RIBBON_W * pxPerWorld,
    waveTopPx: worldToPy(TOP_CENTER + WAVE_TARGET),
    specBotPx: worldToPy(SPEC_BASELINE),
  }
}

function useLayout() {
  const [layout, setLayout] = useState(() => computeLayout(window.innerWidth, window.innerHeight))
  useEffect(() => {
    const onResize = () => setLayout(computeLayout(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return layout
}

function useWindowMs() {
  const [ms, setMs] = useState<number | null>(null)
  useEffect(() => {
    const { sampleRate, fftSize } = getDisplayInfo()
    setMs((fftSize / sampleRate) * 1000)
  }, [])
  return ms
}

function AxisLabels() {
  const layout = useLayout()
  const windowMs = useWindowMs()

  const labelRowStyle = {
    position: 'absolute' as const,
    left: '50%',
    transform: 'translateX(-50%)',
    width: `${layout.ribbonWidthPx}px`,
    pointerEvents: 'none' as const,
    color: 'rgba(180, 220, 255, 0.6)',
    fontFamily: 'monospace',
    fontSize: '0.7rem',
    letterSpacing: '0.08em',
  }

  return (
    <>
      {windowMs !== null && (
        <div
          style={{
            ...labelRowStyle,
            top: `${layout.waveTopPx - 22}px`,
          }}
        >
          {pickTimeTicks(windowMs).map((m) => {
            const frac = m / windowMs
            return (
              <span
                key={m}
                style={{ position: 'absolute', left: `${frac * 100}%`, transform: 'translateX(-50%)' }}
              >
                {m}ms
              </span>
            )
          })}
        </div>
      )}
      <div
        style={{
          ...labelRowStyle,
          top: `${layout.specBotPx + 6}px`,
        }}
      >
        {FREQ_TICKS.map(({ hz, label }) => {
          const frac = Math.log(hz / HZ_LOW) / FREQ_LOG_RANGE
          return (
            <span
              key={hz}
              style={{ position: 'absolute', left: `${frac * 100}%`, transform: 'translateX(-50%)' }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </>
  )
}

function CaptureUI() {
  const layout = useLayout()
  const status = useCaptureStore((s) => s.status)
  const progress = useCaptureStore((s) => s.progress)
  const start = useCaptureStore((s) => s.start)
  const reset = useCaptureStore((s) => s.reset)

  const capturing = status === 'capturing'
  const showReset = status === 'result'
  const remaining = Math.max(0, CAPTURE_DURATION * (1 - progress))

  const primaryLabel = capturing
    ? `Capturing… ${remaining.toFixed(1)}s`
    : status === 'result'
      ? 'Capture Again'
      : 'Capture'

  const buttonBase = {
    pointerEvents: 'auto' as const,
    fontFamily: 'monospace',
    fontSize: '1rem',
    letterSpacing: '0.1em',
    padding: '0.75rem 2rem',
    borderRadius: '6px',
    minWidth: '220px',
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: `${layout.specBotPx + 36}px`,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={start}
          disabled={capturing}
          style={{
            ...buttonBase,
            background: capturing ? 'rgba(0, 224, 255, 0.08)' : '#111',
            color: capturing ? 'rgba(0, 224, 255, 0.6)' : '#0ff',
            border: '1px solid #0ff',
            cursor: capturing ? 'default' : 'pointer',
          }}
        >
          {primaryLabel}
        </button>
        {showReset && (
          <button
            onClick={reset}
            style={{
              ...buttonBase,
              minWidth: '120px',
              background: '#111',
              color: '#f0f',
              border: '1px solid #f0f',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
      </div>
      <div
        style={{
          width: '220px',
          height: '3px',
          background: 'rgba(0, 224, 255, 0.15)',
          borderRadius: '2px',
          overflow: 'hidden',
          opacity: capturing ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: '#0ff',
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </div>
  )
}

export default function Scene() {
  const overlay = isOverlayMode()
  const scene = getSceneParam()

  if (scene === 'fft-morph') {
    return (
      <>
        <Canvas
          orthographic
          gl={{
            antialias: true,
            alpha: overlay,
            powerPreference: 'high-performance',
          }}
          camera={{ zoom: CAMERA_ZOOM, position: [0, 0, 5], near: 0.1, far: 100 }}
          style={{ background: overlay ? 'transparent' : '#000000' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, overlay ? 0 : 1)
          }}
        >
          <FitToViewport>
            <FFTMorph />
          </FitToViewport>
        </Canvas>
        <AxisLabels />
        <CaptureUI />
      </>
    )
  }

  return (
    <Canvas
      gl={{
        antialias: false,
        alpha: overlay,
        powerPreference: 'high-performance',
      }}
      camera={{ position: [0, 6, 12], fov: 50, near: 0.1, far: 100 }}
      style={{ background: '#000000' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, overlay ? 0 : 1)
      }}
    >
      <DrumParticles />
    </Canvas>
  )
}
