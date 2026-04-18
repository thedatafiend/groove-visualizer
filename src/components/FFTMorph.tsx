import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { snapshotFFT } from '../audio/AudioAnalyser'
import { useCaptureStore } from '../stores/useCaptureStore'

const N = 1024
const WAVE_PEAK_FLOOR = 0.05
const WAVE_PEAK_DECAY = 0.92
const SPEC_HEIGHT = 0.7
const THICKNESS = 0.012

const HZ_LOW = 40
const HZ_HIGH = 20000

export const RIBBON_W = 2.8
export const WAVE_TARGET = 0.32
export const TOP_CENTER = 0.55
export const BOTTOM_CENTER = -0.55
export const SPEC_BASELINE = BOTTOM_CENTER - SPEC_HEIGHT / 2
export const SPEC_PEAK = BOTTOM_CENTER + SPEC_HEIGHT / 2

export const CONTENT_HALF_HEIGHT = 1.0
export const CAMERA_ZOOM = 100
export const CAPTURE_DURATION = 5.0

function captureWaveY(out: Float32Array, time: Float32Array, peakState: { value: number }) {
  const stride = time.length / N
  let peak = 0
  for (let i = 0; i < N; i++) {
    const v = Math.abs(time[Math.floor(i * stride)])
    if (v > peak) peak = v
  }
  peakState.value = Math.max(peakState.value * WAVE_PEAK_DECAY, peak, WAVE_PEAK_FLOOR)
  const scale = WAVE_TARGET / peakState.value
  for (let i = 0; i < N; i++) {
    out[i] = time[Math.floor(i * stride)] * scale
  }
}

function captureSpecY(
  out: Float32Array,
  freq: Float32Array,
  sampleRate: number,
  fftSize: number,
  minDb: number,
  maxDb: number,
) {
  const binHz = sampleRate / fftSize
  const range = maxDb - minDb || 1
  for (let i = 0; i < N; i++) {
    const frac = i / (N - 1)
    const hz = HZ_LOW * Math.pow(HZ_HIGH / HZ_LOW, frac)
    let bin = Math.round(hz / binHz)
    if (bin < 0) bin = 0
    if (bin >= freq.length) bin = freq.length - 1
    let norm = (freq[bin] - minDb) / range
    if (norm < 0) norm = 0
    else if (norm > 1) norm = 1
    out[i] = SPEC_BASELINE + norm * SPEC_HEIGHT
  }
}

export default function FFTMorph() {
  const meshRef = useRef<THREE.Mesh>(null!)

  const snapWaveY = useMemo(() => new Float32Array(N), [])
  const liveSpecY = useMemo(() => new Float32Array(N), [])
  const accumSpecY = useMemo(() => {
    const a = new Float32Array(N)
    a.fill(SPEC_BASELINE)
    return a
  }, [])
  const centerY = useMemo(() => new Float32Array(N), [])

  const xCoords = useMemo(() => {
    const arr = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      arr[i] = -RIBBON_W / 2 + (i / (N - 1)) * RIBBON_W
    }
    return arr
  }, [])

  const wavePeakRef = useRef({ value: WAVE_PEAK_FLOOR })
  const captureStartRef = useRef(0)
  const lastRequestIdRef = useRef(0)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(N * 2 * 3)
    const colors = new Float32Array(N * 2 * 3)
    const indices = new Uint32Array((N - 1) * 6)

    for (let i = 0; i < N - 1; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i + 1) * 2
      const d = (i + 1) * 2 + 1
      const o = i * 6
      indices[o] = a
      indices[o + 1] = b
      indices[o + 2] = c
      indices[o + 3] = c
      indices[o + 4] = b
      indices[o + 5] = d
    }

    const cA = new THREE.Color('#00e0ff')
    const cB = new THREE.Color('#ff4cc0')
    const tmp = new THREE.Color()
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1)
      tmp.copy(cA).lerp(cB, t)
      const base = i * 2 * 3
      colors[base] = tmp.r
      colors[base + 1] = tmp.g
      colors[base + 2] = tmp.b
      colors[base + 3] = tmp.r
      colors[base + 4] = tmp.g
      colors[base + 5] = tmp.b
    }

    geo.setIndex(new THREE.BufferAttribute(indices, 1))
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setDrawRange(0, indices.length)
    return geo
  }, [])

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime()
    const mesh = meshRef.current
    if (!mesh) return

    const store = useCaptureStore.getState()
    const s = snapshotFFT()

    captureWaveY(snapWaveY, s.time, wavePeakRef.current)

    if (store.status === 'capturing') {
      if (store.requestId !== lastRequestIdRef.current) {
        lastRequestIdRef.current = store.requestId
        captureStartRef.current = now
        accumSpecY.fill(SPEC_BASELINE)
      }

      captureSpecY(liveSpecY, s.freq, s.sampleRate, s.fftSize, s.minDb, s.maxDb)
      for (let i = 0; i < N; i++) {
        if (liveSpecY[i] > accumSpecY[i]) accumSpecY[i] = liveSpecY[i]
      }

      const progress = Math.min((now - captureStartRef.current) / CAPTURE_DURATION, 1)
      store.setProgress(progress)

      if (progress >= 1) {
        store.setStatus('result')
      }

      for (let i = 0; i < N; i++) {
        const top = snapWaveY[i] + TOP_CENTER
        const bot = accumSpecY[i]
        centerY[i] = top * (1 - progress) + bot * progress
      }
    } else if (store.status === 'result') {
      for (let i = 0; i < N; i++) centerY[i] = accumSpecY[i]
    } else {
      for (let i = 0; i < N; i++) centerY[i] = snapWaveY[i] + TOP_CENTER
    }

    const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const pos = posAttr.array as Float32Array
    const half = THICKNESS / 2

    for (let i = 0; i < N; i++) {
      const iPrev = i === 0 ? 0 : i - 1
      const iNext = i === N - 1 ? N - 1 : i + 1
      const tx = xCoords[iNext] - xCoords[iPrev]
      const ty = centerY[iNext] - centerY[iPrev]
      const len = Math.hypot(tx, ty) || 1
      const nx = -ty / len
      const ny = tx / len

      const base = i * 2 * 3
      pos[base] = xCoords[i] + nx * half
      pos[base + 1] = centerY[i] + ny * half
      pos[base + 2] = 0
      pos[base + 3] = xCoords[i] - nx * half
      pos[base + 4] = centerY[i] - ny * half
      pos[base + 5] = 0
    }

    posAttr.needsUpdate = true
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}
