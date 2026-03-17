// Per-instance attributes
attribute vec3 aOffset;
attribute float aDistance;

// Uniforms
uniform float uTime;
uniform float uKickIntensity;
uniform float uRipplePhase;
uniform float uFlareIntensity;

// Varyings
varying float vRippleHeight;
varying float vFlareIntensity;
varying vec2 vUv;

void main() {
  vec3 pos = aOffset;

  // === KICK RIPPLE ===
  float rippleFreq = 1.8;
  float rippleSpeed = 3.5;
  float rippleWave = sin(aDistance * rippleFreq - uRipplePhase * rippleSpeed);

  // Gaussian envelope at wavefront
  float wavefront = uRipplePhase * rippleSpeed / rippleFreq;
  float envelopeWidth = 3.0;
  float envelope = exp(-pow(aDistance - wavefront, 2.0) / (2.0 * envelopeWidth * envelopeWidth));

  float rippleY = rippleWave * envelope * uKickIntensity * 1.5;
  pos.y += rippleY;

  vRippleHeight = clamp(rippleY / 1.5, -1.0, 1.0);

  // === SNARE FLARE ===
  vec2 radialDir = normalize(aOffset.xz + vec2(0.0001));
  float flareDisplacement = uFlareIntensity * 4.0 * exp(-aDistance * 0.3);
  pos.xz += radialDir * flareDisplacement;
  pos.y += uFlareIntensity * 2.0 * exp(-aDistance * 0.2);

  vFlareIntensity = uFlareIntensity;
  vUv = uv;

  // === BILLBOARD ===
  vec3 cameraRight = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
  vec3 cameraUp = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);

  float sizeMult = 1.0 + abs(vRippleHeight) * 1.0 + uFlareIntensity * 2.5;
  float baseSize = 0.12;

  vec3 billboardPos = pos
    + cameraRight * position.x * baseSize * sizeMult
    + cameraUp * position.y * baseSize * sizeMult;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(billboardPos, 1.0);
}
