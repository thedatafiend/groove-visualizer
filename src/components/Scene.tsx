import { Canvas } from '@react-three/fiber'
import DrumParticles from './DrumParticles'
import { isOverlayMode } from '../overlay'

export default function Scene() {
  const overlay = isOverlayMode()

  return (
    <Canvas
      gl={{
        antialias: false,
        alpha: overlay,
        powerPreference: 'high-performance',
      }}
      camera={{ position: [0, 6, 12], fov: 50, near: 0.1, far: 100 }}
      style={{ background: overlay ? 'transparent' : '#000000' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, overlay ? 0 : 1)
      }}
    >
      <DrumParticles />
    </Canvas>
  )
}
