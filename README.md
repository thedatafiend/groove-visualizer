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
