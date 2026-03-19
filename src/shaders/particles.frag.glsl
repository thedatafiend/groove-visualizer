precision highp float;

varying float vRippleHeight;
varying float vFlareIntensity;
varying vec2 vUv;

void main() {
  // Soft circular falloff
  float dist = length(vUv - 0.5) * 2.0;
  float alpha = 1.0 - smoothstep(0.6, 1.0, dist);

  if (alpha < 0.01) discard;

  // Base color: white
  vec3 baseCyan = vec3(1.0, 1.0, 1.0);

  // Ripple peak (kick): bright cyan
  vec3 rippleWhite = vec3(0.0, 1.0, 1.0);
  float rippleMix = abs(vRippleHeight);

  // Flare: neon pink (#FF007F)
  vec3 flarePink = vec3(1.0, 0.0, 0.498);

  // Blend
  vec3 color = baseCyan;
  color = mix(color, rippleWhite, rippleMix);
  color = mix(color, flarePink, clamp(vFlareIntensity * 2.0, 0.0, 1.0));

  // Emissive boost — high floor so dim particles survive luma key
  float emissiveBoost = 4.5 + rippleMix * 5.0 + vFlareIntensity * 10.0;
  color *= emissiveBoost;

  float finalAlpha = alpha * (0.85 + rippleMix * 0.15 + vFlareIntensity * 0.15);
  finalAlpha = clamp(finalAlpha, 0.0, 1.0);

  gl_FragColor = vec4(color, finalAlpha);
}
