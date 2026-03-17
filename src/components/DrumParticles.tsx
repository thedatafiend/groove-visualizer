import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioValues } from '../audio/AudioAnalyser'
import vertexShader from '../shaders/particles.vert.glsl'
import fragmentShader from '../shaders/particles.frag.glsl'

const PARTICLE_COUNT = 10_000
const DISC_RADIUS = 9.0
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function createGeometry(): THREE.InstancedBufferGeometry {
  const base = new THREE.PlaneGeometry(0.12, 0.12)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.attributes.position = base.attributes.position
  geo.attributes.uv = base.attributes.uv

  const offsets = new Float32Array(PARTICLE_COUNT * 3)
  const distances = new Float32Array(PARTICLE_COUNT)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = i * GOLDEN_ANGLE
    const r = Math.sqrt(i / PARTICLE_COUNT) * DISC_RADIUS
    offsets[i * 3 + 0] = r * Math.cos(theta)
    offsets[i * 3 + 1] = 0
    offsets[i * 3 + 2] = r * Math.sin(theta)
    distances[i] = r
  }

  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3))
  geo.setAttribute('aDistance', new THREE.InstancedBufferAttribute(distances, 1))
  geo.instanceCount = PARTICLE_COUNT

  return geo
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uKickIntensity: { value: 0 },
      uSnareIntensity: { value: 0 },
      uRipplePhase: { value: 0 },
      uFlareIntensity: { value: 0 },
      uFlareTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

export default function DrumParticles() {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const ripplePhaseRef = useRef(0)
  const flareTimeRef = useRef(100)
  const prevKickRef = useRef(0)

  const geometry = useMemo(() => createGeometry(), [])
  const material = useMemo(() => createMaterial(), [])

  // Store ref to material for useFrame access
  materialRef.current = material

  useFrame((_, delta) => {
    const mat = materialRef.current
    if (!mat) return

    const kick = audioValues.kickIntensity
    const snare = audioValues.snareIntensity

    // Ripple phase — advances continuously, resets on kick onset
    ripplePhaseRef.current += delta * (1.0 + kick * 4.0)
    if (kick > 0.6 && prevKickRef.current < 0.5) {
      ripplePhaseRef.current = 0
    }
    prevKickRef.current = kick

    // Flare — trigger on snare onset, exponential decay
    if (snare > 0.5 && flareTimeRef.current > 0.3) {
      flareTimeRef.current = 0
    }
    flareTimeRef.current += delta
    const flareIntensity = Math.exp(-3.0 * flareTimeRef.current)

    // Update uniforms
    mat.uniforms.uTime.value += delta
    mat.uniforms.uKickIntensity.value = kick
    mat.uniforms.uSnareIntensity.value = snare
    mat.uniforms.uRipplePhase.value = ripplePhaseRef.current
    mat.uniforms.uFlareIntensity.value = flareIntensity
    mat.uniforms.uFlareTime.value = flareTimeRef.current
  })

  return <mesh geometry={geometry} material={material} position={[0, 2, 0]} />
}
