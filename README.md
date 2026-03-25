# Groove Visualizer

Real-time audio-reactive particle visualizer for drums. 10,000 particles arranged in a Fibonacci disc respond to kick and snare hits with ripple waves and radial flares.

## Features

- **Live mic input** — start the visualizer and play drums near your mic
- **Video file input** — load a video clip and the audio drives the particles
- **OBS overlay mode** — open with `?overlay` for a transparent background, ready to layer over your camera in OBS
- **Debug overlay** — press `D` to see the FFT spectrum, frequency bands, and intensity meters

## Signal Flow

```
┌─────────────────────┐     ┌──────────────────────┐
│   Microphone Input   │     │   Video/Audio Element │
│  (getUserMedia)      │     │ (createMediaElement   │
│                      │     │       Source)          │
└─────────┬───────────┘     └──────────┬────────────┘
          │                            │
          │  MediaStreamSource         │  MediaElementSource
          └───────────┬────────────────┘
                      ▼
          ┌───────────────────────┐
          │     AnalyserNode      │
          │  FFT size: 2048       │
          │  1024 frequency bins  │
          │  smoothing: 0.4       │
          └───────────┬───────────┘
                      │
                      │  getFloatFrequencyData (dB values)
                      ▼
          ┌───────────────────────┐
          │  Frequency Band Split │
          │                       │
          │  Kick:  30 – 90 Hz    │
          │  Snare: 150 – 300 Hz  │
          │                       │
          │  dB → linear per bin  │
          │  averaged across band │
          └───────────┬───────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │  Auto-Gain + Gating   │
          │                       │
          │  Peak tracking w/     │
          │  0.999 decay          │
          │  Normalize to 0–1     │
          │  Gate: kick > 0.3     │
          │        snare > 0.5    │
          └───────────┬───────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │   Envelope Follower   │
          │                       │
          │  Attack:  0.8         │
          │  Release: 0.05        │
          │                       │
          │  → kickIntensity      │
          │  → snareIntensity     │
          └───────┬───────┬───────┘
                  │       │
        ┌─────────┘       └──────────┐
        ▼                            ▼
┌───────────────────┐    ┌────────────────────┐
│  Particle Shader  │    │   Debug Overlay    │
│  (DrumParticles)  │    │  (DebugOverlay)    │
│                   │    │                    │
│  kick → ripple    │    │  FFT spectrum bars │
│  waves (Y disp.)  │    │  Band highlights   │
│                   │    │  Intensity meters  │
│  snare → radial   │    │                    │
│  flare burst      │    │  Press D to toggle │
│                   │    │                    │
│  10,000 instanced │    └────────────────────┘
│  billboard quads  │
│                   │
│  Colors:          │
│   ripple → cyan   │
│   flare  → pink   │
└───────────────────┘
```

### Key Files

| File | Role |
|------|------|
| `src/audio/AudioAnalyser.ts` | FFT analysis, frequency band extraction, envelope follower |
| `src/App.tsx` | Audio initialization (mic or video source) |
| `src/components/DrumParticles.tsx` | Particle geometry, passes audio uniforms to shaders |
| `src/shaders/particles.vert.glsl` | Vertex displacement driven by kick/snare intensity |
| `src/shaders/particles.frag.glsl` | Color mixing (cyan ripples, pink flares) |
| `src/components/DebugOverlay.tsx` | 2D canvas FFT spectrum and intensity meters |

## How the Particle Visualization Works

### Particle Layout

10,000 particles are arranged in a **Fibonacci disc** (golden-angle spiral) of radius 9 on the XZ plane. Each particle stores its radial distance from center (`aDistance`) as an instance attribute. Particles are rendered as **instanced billboard quads** (always face the camera) with additive blending so overlapping particles brighten rather than occlude.

### Kick Effect — Ripple Waves

When `kickIntensity` is high, a **sinusoidal ripple** propagates outward from the disc center:

1. **DrumParticles.tsx** tracks a `ripplePhase` that advances each frame. On a kick onset (intensity crosses above 0.6), the phase resets to 0, spawning a new wavefront.
2. The **vertex shader** computes a sine wave along each particle's distance, multiplied by a Gaussian envelope centered at the wavefront. This displaces particles vertically (Y axis), creating a visible ripple ring expanding outward.
3. The **fragment shader** tints particles at ripple peaks **cyan** (`#00FFFF`), blended proportionally to the ripple displacement height.

### Snare Effect — Radial Flare

When `snareIntensity` is high, a **radial burst** explodes outward:

1. **DrumParticles.tsx** triggers a flare on snare onset (intensity > 0.5 with a cooldown). The flare intensity decays exponentially: `exp(-3.0 * timeSinceFlare)`.
2. The **vertex shader** pushes particles outward in the XZ plane and upward in Y, with displacement strongest near the center (`exp(-aDistance * 0.3)`).
3. The **fragment shader** tints flare-affected particles **neon pink** (`#FF007F`) and boosts emissive intensity dramatically.

### Particle Sizing and Brightness

Billboard size scales dynamically: `1.0 + |rippleHeight| + flareIntensity * 2.5`. The fragment shader applies a soft circular falloff and a high emissive floor (`4.5+`) so even idle particles are visible under OBS luma key.

## Extending with New Frequency Bands

The architecture is designed so adding a new instrument band follows a repeatable pattern. Here's a walkthrough using a **cymbal/hi-hat** (8–16 kHz) as an example:

### 1. Add the frequency band in `AudioAnalyser.ts`

```ts
// New constants
export const CYMBAL_LO_HZ = 8000
export const CYMBAL_HI_HZ = 16000

// New state
let smoothCymbal = 0
let maxCymbal = 0.001

// Export on audioValues
export const audioValues = {
  kickIntensity: 0,
  snareIntensity: 0,
  cymbalIntensity: 0,  // ← new
}
```

In `tick()`, add extraction logic identical to the kick/snare pattern — sum bins in range, auto-gain normalize, gate (try threshold ~0.4), and run through the envelope follower.

### 2. Pass the value to the shader in `DrumParticles.tsx`

Add a new uniform (`uCymbalIntensity`) to `createMaterial()` and update it each frame in `useFrame` from `audioValues.cymbalIntensity`. You may also want a time-based envelope (like `flareTimeRef` for snare) if the effect should trigger-and-decay rather than follow continuously.

### 3. Add the visual effect in the vertex/fragment shaders

Some ideas for a cymbal effect:

| Effect | How |
|--------|-----|
| **Shimmer / jitter** | Add high-frequency noise to particle Y positions: `pos.y += uCymbalIntensity * noise(aOffset.xz * 40.0 + uTime * 10.0) * 0.3` |
| **Edge sparkle** | Only affect particles near the disc edge: `float edgeMask = smoothstep(6.0, 9.0, aDistance); pos.y += edgeMask * uCymbalIntensity * noise(...)` |
| **Color** | Tint affected particles gold/white: `vec3 cymbalColor = vec3(1.0, 0.85, 0.2)` mixed by intensity |
| **Size pulse** | Scale billboard size: `sizeMult += uCymbalIntensity * edgeMask * 1.5` |

### 4. Update the debug overlay in `DebugOverlay.tsx`

Add a third highlighted frequency region (e.g., yellow) for the 8–16 kHz band and a third intensity meter bar.

### General Tips

- **Threshold tuning** — use the debug overlay (`D` key) to watch the FFT spectrum while playing. Adjust `_LO_HZ`, `_HI_HZ`, and gate thresholds until the band isolates the target instrument cleanly.
- **Envelope shape** — fast attack + slow release works for percussive hits. For sustained sounds (ride cymbal wash), try lower attack (0.3–0.5) and higher release (0.1–0.2).
- **Avoiding visual clutter** — give each band a distinct spatial region (center vs edge), motion axis (Y vs XZ vs rotation), and color to keep effects readable.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## OBS Overlay

1. Run `npm run dev`
2. In OBS: Add Source → Browser → URL: `http://localhost:5173?overlay`
3. Set width/height to match your canvas (e.g., 1920×1080)
4. Layer above your camera source
5. Route audio via [BlackHole](https://existential.audio/blackhole/) or similar virtual audio device

## Tech Stack

- React + TypeScript
- Three.js / React Three Fiber
- Web Audio API (FFT analysis)
- GLSL shaders (instanced billboards, additive blending)
- Vite
