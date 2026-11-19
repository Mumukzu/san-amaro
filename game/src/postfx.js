// Post-processing for San Amaro: UnrealBloom (neon glow, lit windows, lamp
// heads) + a warm film grade with vignette and a whisper of grain. Vendored
// three r160 postprocessing modules live under game/vendor/ (same version as
// the vendored three.min.js, so the passes match the renderer exactly).
// The chain runs on half-float render targets: emissive values above the
// bloom threshold glow, the rest of the frame is untouched.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { ShaderPass } from '../vendor/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';

// Warm grade: lift the shadows toward teal, push the highlights toward
// gold, add a vignette so the frame reads as a film still, and a faint
// grain so flat gradients never band. `amount` lets the grade fade in.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 1.0 },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform float time;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Warm highlights / cool shadows (the Miami-sunset grade).
      vec3 warm = vec3(1.06, 1.0, 0.94);
      vec3 cool = vec3(0.94, 0.98, 1.06);
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 graded = mix(c.rgb * cool, c.rgb * warm, smoothstep(0.25, 0.85, lum));
      // Gentle S-curve for contrast.
      graded = mix(graded, graded * graded * (3.0 - 2.0 * graded), 0.12);
      // Vignette.
      float d = distance(vUv, vec2(0.5));
      graded *= 1.0 - smoothstep(0.45, 0.85, d) * 0.28;
      // Grain (faint, time-animated so it never reads as a static pattern).
      graded += (hash(vUv * 913.0 + fract(time) * 17.0) - 0.5) * 0.018;
      gl_FragColor = vec4(mix(c.rgb, graded, amount), c.a);
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    // Bloom: only the bright stuff glows (threshold 0.85 in linear HDR).
    // Strength 0.38 is the sweet spot: neon and lamp heads bloom, the
    // ground and facades stay clean.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.55, 0.85);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.enabled = true;
    this.bloomOn = true;
    this.setSize(window.innerWidth, window.innerHeight);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w / 2, h / 2);
  }

  // Preset-aware bloom: golden hour and night glow more than midday.
  // The warm grade follows the same curve (strongest at golden hour, a
  // touch lighter at midday) so the grade and the bloom never disagree
  // about how golden the frame is (slice 3).
  setPreset(name) {
    this.bloom.strength = name === 'day' ? 0.22 : name === 'night' ? 0.45 : 0.38;
    this.grade.uniforms.amount.value = name === 'day' ? 0.8 : name === 'night' ? 0.9 : 1.0;
  }

  setBloom(on) {
    this.bloomOn = on;
    this.bloom.enabled = on;
  }

  render(delta) {
    this.grade.uniforms.time.value += delta;
    if (this.enabled) this.composer.render();
    else this.renderer.render(this.composer.passes[0].scene, this.composer.passes[0].camera);
  }
}
