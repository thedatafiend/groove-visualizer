# Groove Visualizer

Real-time audio-reactive particle visualizer for drums. 10,000 particles arranged in a Fibonacci disc respond to kick and snare hits with ripple waves and radial flares.

## Features

- **Live mic input** — start the visualizer and play drums near your mic
- **Video file input** — load a video clip and the audio drives the particles
- **OBS overlay mode** — open with `?overlay` for a transparent background, ready to layer over your camera in OBS
- **Debug overlay** — press `D` to see the FFT spectrum, frequency bands, and intensity meters

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
