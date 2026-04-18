let audioCtx: AudioContext
let analyser: AnalyserNode
let freqData: Float32Array
let displayAnalyser: AnalyserNode
let displayFreqData: Float32Array
let displayTimeData: Float32Array
let ticking = false

const DISPLAY_FFT_SIZE = 8192

/** Mutable values read by the render loop — no React re-renders */
export const audioValues = {
  kickIntensity: 0,
  snareIntensity: 0,
}

export const KICK_LO_HZ = 30
export const KICK_HI_HZ = 90
export const SNARE_LO_HZ = 150
export const SNARE_HI_HZ = 300

const ATTACK = 0.8
const RELEASE = 0.05

let smoothKick = 0
let smoothSnare = 0
let maxKick = 0.001
let maxSnare = 0.001

/** Expose raw FFT data for the debug overlay */
export function getDebugData() {
  return {
    freqData,
    sampleRate: audioCtx?.sampleRate ?? 48000,
    fftSize: analyser?.fftSize ?? 2048,
  }
}

/** Stable snapshot from the display analyser (larger fftSize, covers a longer time window). */
export function snapshotFFT() {
  return {
    freq: new Float32Array(displayFreqData),
    time: new Float32Array(displayTimeData),
    minDb: displayAnalyser.minDecibels,
    maxDb: displayAnalyser.maxDecibels,
    sampleRate: audioCtx.sampleRate,
    fftSize: displayAnalyser.fftSize,
  }
}

/** Static info about the display analyser — used for layout (time-window labels). */
export function getDisplayInfo() {
  return {
    sampleRate: audioCtx?.sampleRate ?? 48000,
    fftSize: displayAnalyser?.fftSize ?? DISPLAY_FFT_SIZE,
  }
}

function setupAnalyser() {
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.4
  freqData = new Float32Array(analyser.frequencyBinCount)

  displayAnalyser = audioCtx.createAnalyser()
  displayAnalyser.fftSize = DISPLAY_FFT_SIZE
  displayAnalyser.smoothingTimeConstant = 0.3
  displayFreqData = new Float32Array(displayAnalyser.frequencyBinCount)
  displayTimeData = new Float32Array(displayAnalyser.fftSize)

  if (!ticking) {
    ticking = true
    tick()
  }
}

const audioConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

/**
 * Find an audio input device whose label contains `name`.
 * Must be called after getUserMedia (labels are blank until permission is granted).
 */
async function findAudioDevice(name: string): Promise<string | undefined> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioInputs = devices.filter((d) => d.kind === 'audioinput')
  console.log('[audio] available inputs:', audioInputs.map((d) => d.label))
  const match = audioInputs.find((d) => d.label.includes(name))
  if (match) console.log('[audio] matched device:', match.label)
  else console.log('[audio] no match for:', name, '— using default')
  return match?.deviceId
}

/** Audio-input mode — optionally target a device by name (e.g. "BlackHole") */
export async function initAudio(preferredDevice?: string) {
  audioCtx = new AudioContext()
  await audioCtx.resume()

  // First request grants permission and populates device labels
  let stream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints,
  })

  // If a preferred device was requested, find it and re-open
  if (preferredDevice) {
    const deviceId = await findAudioDevice(preferredDevice)
    if (deviceId) {
      stream.getTracks().forEach((t) => t.stop())
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...audioConstraints, deviceId: { exact: deviceId } },
      })
    }
  }

  const source = audioCtx.createMediaStreamSource(stream)

  setupAnalyser()
  source.connect(analyser)
  source.connect(displayAnalyser)
}

/** Video/audio element input mode — audio plays through speakers */
export async function initAudioFromElement(mediaElement: HTMLMediaElement) {
  audioCtx = new AudioContext()
  await audioCtx.resume()

  const source = audioCtx.createMediaElementSource(mediaElement)

  setupAnalyser()
  source.connect(analyser)
  source.connect(displayAnalyser)
  analyser.connect(audioCtx.destination)
}

function tick() {
  requestAnimationFrame(tick)
  analyser.getFloatFrequencyData(freqData)
  displayAnalyser.getFloatFrequencyData(displayFreqData)
  displayAnalyser.getFloatTimeDomainData(displayTimeData)

  const binHz = audioCtx.sampleRate / analyser.fftSize

  const kickLo = Math.floor(KICK_LO_HZ / binHz)
  const kickHi = Math.ceil(KICK_HI_HZ / binHz)
  let kickSum = 0
  for (let i = kickLo; i <= kickHi; i++) {
    kickSum += Math.pow(10, freqData[i] / 20)
  }
  kickSum /= kickHi - kickLo + 1

  const snareLo = Math.floor(SNARE_LO_HZ / binHz)
  const snareHi = Math.ceil(SNARE_HI_HZ / binHz)
  let snareSum = 0
  for (let i = snareLo; i <= snareHi; i++) {
    snareSum += Math.pow(10, freqData[i] / 20)
  }
  snareSum /= snareHi - snareLo + 1

  // Auto-gain normalization
  maxKick = Math.max(maxKick * 0.999, kickSum)
  maxSnare = Math.max(maxSnare * 0.999, snareSum)
  const normKick = Math.min(kickSum / maxKick, 1.0)
  const normSnare = Math.min(snareSum / maxSnare, 1.0)

  // Gate — ignore signals below threshold
  const KICK_THRESHOLD = 0.3
  const SNARE_THRESHOLD = 0.5
  const gatedKick = normKick > KICK_THRESHOLD ? (normKick - KICK_THRESHOLD) / (1.0 - KICK_THRESHOLD) : 0
  const gatedSnare = normSnare > SNARE_THRESHOLD ? (normSnare - SNARE_THRESHOLD) / (1.0 - SNARE_THRESHOLD) : 0

  // Envelope follower
  smoothKick += (gatedKick > smoothKick ? ATTACK : RELEASE) * (gatedKick - smoothKick)
  smoothSnare += (gatedSnare > smoothSnare ? ATTACK : RELEASE) * (gatedSnare - smoothSnare)

  audioValues.kickIntensity = smoothKick
  audioValues.snareIntensity = smoothSnare
}
