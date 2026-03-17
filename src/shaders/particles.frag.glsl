precision highp float;

varying float vRippleHeight;
varying float vFlareIntensity;
varying vec2 vUv;

void main() {
  // Soft circular falloff
  float dist = length(vUv - 0.5) * 2.0;
  float alpha = 1.0 - smoothstep(0.6, 1.0, dist);

  if (alpha < 0.01) discard;

  // Base color: vivid cyan
  vec3 baseCyan = vec3(0.0, 0.9, 1.0);

  // Ripple peak: bright white
  vec3 rippleWhite = vec3(1.0, 1.0, 1.0);
  float rippleMix = abs(vRippleHeight);

  // Flare: neon pink (#FF007F)
  vec3 flarePink = vec3(1.0, 0.0, 0.498);

  // Blend
  vec3 color = baseCyan;
  color = mix(color, rippleWhite, rippleMix * 0.8);
  color = mix(color, flarePink, vFlareIntensity);

  // Emissive boost
  float emissiveBoost = 1.5 + rippleMix * 3.0 + vFlareIntensity * 4.0;
  color *= emissiveBoost;

  float finalAlpha = alpha * (0.6 + rippleMix * 0.4 + vFlareIntensity * 0.4);
  finalAlpha = clamp(finalAlpha, 0.0, 1.0);

  gl_FragColor = vec4(color, finalAlpha);
}
