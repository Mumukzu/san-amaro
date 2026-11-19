// Sky dome, sun, fog and environment lighting, driven by time-of-day presets.
// One directional sun with a shadow camera that follows the player; the sky is
// a shader gradient (warm horizon, deep zenith, sun disc, stars at night).
// A PMREM environment map is baked from the sky so glass and wet roads reflect it.
import * as THREE from 'three';
import { TIME_PRESETS } from './config.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // pin the dome to the far plane
}`;

const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float starAmount;
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float cloudBand(vec3 d, vec3 sunDir) {
  // Cheap soft clouds: two ADDED low-frequency sine bands near the horizon
  // (added, not multiplied — a product leaves large holes with no clouds;
  // low frequency so the bands are hundreds of degrees wide and every
  // camera direction catches some cloud). Brightest on the sun side.
  float band = 0.5
    + 0.35 * sin(d.x * 1.5 + d.z * 1.0 + 0.5)
    + 0.35 * sin(d.z * 2.0 - d.x * 1.0 + 2.0);
  float horiz = 1.0 - smoothstep(0.02, 0.55, d.y); // only low in the sky
  float sunSide = 0.5 + 0.5 * dot(normalize(d), normalize(sunDir));
  return smoothstep(0.35, 0.65, band) * horiz * (0.6 + 0.4 * sunSide);
}
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(horizonColor, topColor, pow(h, 0.4));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 350.0) * 1.6 + pow(s, 24.0) * 0.55 + pow(s, 6.0) * 0.45);
  // Cloud bands: BRIGHT warm white, clearly lighter than the sky itself —
  // the old cloud colour was the same orange as the horizon, so the clouds
  // were invisible at sunset.
  float cl = cloudBand(d, sunDir);
  vec3 cloudCol = vec3(1.0, 0.85, 0.7) * 1.15;
  col = mix(col, cloudCol, cl * 0.7 * (1.0 - starAmount));
  if (starAmount > 0.001 && d.y > 0.03) {
    vec3 cell = floor(d * 160.0);
    float hsh = hash13(cell);
    if (hsh > 0.996) {
      float tw = 0.6 + 0.4 * sin(hsh * 40.0);
      // Kept below the bloom threshold so stars stay points, not blobs.
      col += vec3(0.9, 0.95, 1.0) * starAmount * tw * smoothstep(0.996, 1.0, hsh) * 0.8;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function presetToColors(p) {
  return {
    sunColor: new THREE.Color(p.sunColor),
    hemiSky: new THREE.Color(p.hemiSky),
    hemiGround: new THREE.Color(p.hemiGround),
    skyTop: new THREE.Color(p.skyTop),
    skyHorizon: new THREE.Color(p.skyHorizon),
    fogColor: new THREE.Color(p.fogColor),
  };
}

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.uniforms = {
      topColor: { value: new THREE.Color(0x5a4a8a) },
      horizonColor: { value: new THREE.Color(0xff9d5c) },
      sunDir: { value: new THREE.Vector3(0, 0.2, -1) },
      sunColor: { value: new THREE.Color(0xff9d42) },
      starAmount: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(850, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xff9d42, 3.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -120;
    this.sun.shadow.camera.right = 120;
    this.sun.shadow.camera.top = 120;
    this.sun.shadow.camera.bottom = -120;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 500;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xb98a7a, 0x4a3f36, 0.38);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0xd89a6a, 0.0016);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    const envDome = new THREE.Mesh(geo, mat);
    this.envScene.add(envDome);
    this.current = 'sunset';
    this.from = null; this.to = null; this.blend = 1;
    this.applyPreset('sunset', true);
  }

  // Bake the environment map from the current sky (reflections for glass/wet road).
  bakeEnvironment() {
    const rt = this.pmrem.fromScene(this.envScene, 0.04);
    if (this.scene.environment) this.scene.environment.dispose();
    this.scene.environment = rt.texture;
  }

  applyPreset(name, instant = false) {
    const p = TIME_PRESETS[name];
    if (!p) return;
    this.current = name;
    this.from = this.snapshot();
    this.to = { ...p, ...presetToColors(p) };
    this.blend = instant ? 1 : 0;
    if (instant) {
      this.writeState(this.to);
      this.bakeEnvironment();
    }
  }

  snapshot() {
    return {
      sunColor: this.sun.color.clone(),
      hemiSky: this.hemi.color.clone(),
      hemiGround: this.hemi.groundColor.clone(),
      skyTop: this.uniforms.topColor.value.clone(),
      skyHorizon: this.uniforms.horizonColor.value.clone(),
      fogColor: this.scene.fog.color.clone(),
      sunIntensity: this.sun.intensity,
      hemiIntensity: this.hemi.intensity,
      fogDensity: this.scene.fog.density,
      exposure: this.renderer.toneMappingExposure,
      windowGlow: this.windowGlow ?? 0.55,
      lampOn: this.lampOn ?? true,
      headlightOn: this.headlightOn ?? true,
      sunElev: this.sunElev ?? 13,
      sunAzim: this.sunAzim ?? 252,
      stars: this.stars ?? 0,
    };
  }

  writeState(s) {
    const elev = (s.sunElev * Math.PI) / 180;
    const azim = (s.sunAzim * Math.PI) / 180;
    const dir = new THREE.Vector3(
      Math.cos(elev) * Math.sin(azim),
      Math.sin(elev),
      Math.cos(elev) * Math.cos(azim),
    );
    this.uniforms.sunDir.value.copy(dir);
    this.uniforms.topColor.value.copy(s.skyTop);
    this.uniforms.horizonColor.value.copy(s.skyHorizon);
    this.uniforms.sunColor.value.copy(s.sunColor);
    // Stars are a preset property now (the old sunIntensity<1 test broke
    // when night moonlight was raised to 1.0: no stars, and the bright
    // clouds rendered all night, washing the sky pale).
    this.uniforms.starAmount.value = s.stars ?? 0;
    this.stars = s.stars ?? 0;
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sunIntensity;
    this.hemi.color.copy(s.hemiSky);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemiIntensity;
    this.scene.fog.color.copy(s.fogColor);
    this.scene.fog.density = s.fogDensity;
    this.renderer.toneMappingExposure = s.exposure;
    this.windowGlow = s.windowGlow;
    this.lampOn = s.lampOn;
    this.headlightOn = s.headlightOn;
    this.sunElev = s.sunElev;
    this.sunAzim = s.sunAzim;
    this.sunDir = dir;
  }

  update(dt, playerPos) {
    if (this.blend < 1 && this.from && this.to) {
      this.blend = Math.min(1, this.blend + dt / 1.5);
      const t = this.blend * this.blend * (3 - 2 * this.blend); // smoothstep
      const mix = (a, b) => (a.clone().lerp(b, t));
      const s = {
        sunColor: mix(this.from.sunColor, this.to.sunColor),
        hemiSky: mix(this.from.hemiSky, this.to.hemiSky),
        hemiGround: mix(this.from.hemiGround, this.to.hemiGround),
        skyTop: mix(this.from.skyTop, this.to.skyTop),
        skyHorizon: mix(this.from.skyHorizon, this.to.skyHorizon),
        fogColor: mix(this.from.fogColor, this.to.fogColor),
        sunIntensity: this.from.sunIntensity + (this.to.sunIntensity - this.from.sunIntensity) * t,
        hemiIntensity: this.from.hemiIntensity + (this.to.hemiIntensity - this.from.hemiIntensity) * t,
        fogDensity: this.from.fogDensity + (this.to.fogDensity - this.from.fogDensity) * t,
        exposure: this.from.exposure + (this.to.exposure - this.from.exposure) * t,
        windowGlow: this.from.windowGlow + (this.to.windowGlow - this.from.windowGlow) * t,
        lampOn: t > 0.5 ? this.to.lampOn : this.from.lampOn,
        headlightOn: t > 0.5 ? this.to.headlightOn : this.from.headlightOn,
        sunElev: this.from.sunElev + (this.to.sunElev - this.from.sunElev) * t,
        sunAzim: this.from.sunAzim + (this.to.sunAzim - this.from.sunAzim) * t,
        stars: this.from.stars + (this.to.stars - this.from.stars) * t,
      };
      this.writeState(s);
      if (this.blend >= 1) this.bakeEnvironment();
    }
    // Keep the shadow frustum centred on the player so shadows stay crisp.
    const px = playerPos ? playerPos.x : 0;
    const pz = playerPos ? playerPos.z : 0;
    const d = this.sunDir || new THREE.Vector3(0, 0.2, -1);
    this.sun.position.set(px + d.x * 180, d.y * 180 + 20, pz + d.z * 180);
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();
    this.dome.position.set(px, 0, pz);
  }
}
