// Pool water: animated surface shader (waves, impact ripples, player wakes, foam, fresnel
// reflection of the arena lights, refraction tint) + tiled pool floor with animated caustics.
import * as THREE from '../vendor/three.module.min.js';

export const WATER_PARAMS = {
  WaveIntensity: 1, WaveSpeed: 1, ReflectionStrength: 1, RefractionStrength: 1, FoamAmount: 1,
  Transparency: 0.4, DepthFade: 1, CausticsIntensity: 1, SurfaceSmoothness: 0.85, SplashIntensity: 1,
};

const MAX_RIPPLES = 24, MAX_WAKES = 14;
export const POOL = { length: 25, width: 20, marginX: 2, marginZ: 1, depth: 2 };

/** Tileable micro-wave normal map generated once on the CPU (no texture download). */
function makeNormalMap(size = 256) {
  const h = new Float32Array(size * size);
  const rnd = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
  for (const [freq, amp, seed] of [[4, 1, 1], [8, 0.5, 2], [16, 0.25, 3], [32, 0.12, 4]]) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * freq, fy = (y / size) * freq;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const w = (a, b) => rnd(((a % freq) + freq) % freq, ((b % freq) + freq) % freq, seed);
      const v = (w(x0, y0) * (1 - sx) + w(x0 + 1, y0) * sx) * (1 - sy) + (w(x0, y0 + 1) * (1 - sx) + w(x0 + 1, y0 + 1) * sx) * sy;
      h[y * size + x] += v * amp;
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
    const d = h[((y - 1 + size) % size) * size + x], u = h[((y + 1) % size) * size + x];
    let nx = (l - r) * 2.2, nz = (d - u) * 2.2; const ny = 1; const len = Math.hypot(nx, ny, nz);
    const i = (y * size + x) * 4;
    data[i] = ((nx / len) * 0.5 + 0.5) * 255; data[i + 1] = ((nz / len) * 0.5 + 0.5) * 255; data[i + 2] = ((ny / len) * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

const waterVertex = /* glsl */`
uniform float uTime, uWave, uWaveSpeed;
uniform vec4 uRipples[${MAX_RIPPLES}];   // x, z, start time, strength
uniform vec4 uWakes[${MAX_WAKES}];       // x, z, velocity x, velocity z
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vFoam;

float sq(float x) { return x * x; }
float ripples(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 4.0) continue;
    float d = distance(p, r.xy);
    float front = age * 2.2;                                   // ring speed (m/s)
    float env = exp(-sq((d - front) * 2.6)) * exp(-age * 1.3);
    h += sin((d - front) * 9.0) * env * r.w * 0.06;
  }
  return h;
}
float wakes(vec2 p, out float foam) {
  float h = 0.0; foam = 0.0;
  for (int i = 0; i < ${MAX_WAKES}; i++) {
    vec4 w = uWakes[i];
    float sp = length(w.zw);
    vec2 d = p - w.xy;
    float r2 = dot(d, d);
    h -= exp(-r2 * 6.0) * 0.035;                               // body displaces water
    if (sp < 0.15) continue;
    vec2 dir = w.zw / sp;
    float behind = -dot(d, dir);
    float lateral = abs(dot(d, vec2(-dir.y, dir.x)));
    if (behind > -0.4 && behind < 4.0) {
      float v = exp(-sq(lateral - max(behind, 0.0) * 0.38 - 0.25) * 18.0) * exp(-max(behind, 0.0) * 1.0);
      h += v * sp * 0.025;
      foam += v * smoothstep(0.6, 2.2, sp) * 0.6;
    }
    foam += exp(-r2 * 12.0) * smoothstep(0.5, 2.0, sp) * 0.35;  // bow foam around the swimmer
  }
  return h;
}
float swell(vec2 p) {
  float t = uTime * uWaveSpeed;
  return (sin(p.x * 0.9 + t * 1.3) * 0.020 + sin(p.y * 1.25 - t * 1.1) * 0.016
        + sin((p.x + p.y) * 2.3 + t * 2.1) * 0.008 + sin((p.x - p.y) * 3.7 - t * 2.7) * 0.004) * uWave;
}
float heightAt(vec2 p, out float foam) { return swell(p) + ripples(p) + wakes(p, foam); }

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float foam, f1, f2;
  float h = heightAt(world.xz, foam);
  float e = 0.08;
  float hx = heightAt(world.xz + vec2(e, 0.0), f1);
  float hz = heightAt(world.xz + vec2(0.0, e), f2);
  world.y += h;
  vNormalW = normalize(vec3(h - hx, e, h - hz));
  vWorld = world.xyz;
  vFoam = foam;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const waterFragment = /* glsl */`
uniform float uTime, uDetail, uReflect, uFoamAmt, uAlpha, uSmooth;
uniform vec3 uDeep, uShallow, uSkyTop, uSkyLow, uLightCol, uSunDir;
uniform sampler2D uNormalMap;
uniform vec2 uHalf;                       // half size of the basin (x, z)
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vFoam;

// Reflection of the arena: dark roof with rows of bright light panels.
vec3 arenaReflection(vec3 r) {
  vec3 sky = mix(uSkyLow, uSkyTop, smoothstep(0.0, 0.6, r.y));
  if (r.y > 0.05) {
    vec2 hit = vWorld.xz + r.xz * ((14.0 - vWorld.y) / r.y);   // roof plane at 14 m
    vec2 cell = abs(fract(hit / vec2(6.0, 5.0)) - 0.5);
    float panel = smoothstep(0.16, 0.10, cell.x) * smoothstep(0.32, 0.26, cell.y);
    panel *= step(abs(hit.x), 30.0) * step(abs(hit.y), 24.0);
    sky += uLightCol * panel * 2.2;
  }
  return sky;
}

void main() {
  vec3 n = vNormalW;
  if (uDetail > 0.5) {
    vec2 uv = vWorld.xz * 0.18;
    vec3 n1 = texture2D(uNormalMap, uv + vec2(uTime * 0.020, uTime * 0.013)).xzy * 2.0 - 1.0;
    vec3 n2 = texture2D(uNormalMap, uv * 2.3 - vec2(uTime * 0.017, -uTime * 0.025)).xzy * 2.0 - 1.0;
    n = normalize(n + vec3(n1.x + n2.x, 0.0, n1.z + n2.z) * (1.0 - uSmooth) * 0.9);
  }
  vec3 v = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

  vec3 refl = arenaReflection(reflect(-v, n)) * uReflect;
  // Body colour: shallow turquoise near the camera / grazing angle -> deep blue.
  vec3 body = mix(uShallow, uDeep, smoothstep(0.15, 0.9, 1.0 - ndv));
  vec3 col = mix(body, refl, clamp(fresnel * 1.15, 0.0, 1.0));

  // Specular glints from the key light.
  vec3 hdir = normalize(uSunDir + v);
  col += uLightCol * pow(max(dot(n, hdir), 0.0), 220.0) * 1.6;

  // Foam: wakes, impacts (vFoam) + a thin band along the walls.
  vec2 edge = uHalf - abs(vWorld.xz);
  float wallFoam = (1.0 - smoothstep(0.0, 0.35, min(edge.x, edge.y))) * 0.6;
  float grain = texture2D(uNormalMap, vWorld.xz * 0.9 + uTime * 0.05).r;
  float foam = clamp((vFoam * uFoamAmt + wallFoam) * smoothstep(0.35, 0.75, grain + vFoam * 0.3), 0.0, 1.0);
  col = mix(col, vec3(0.93, 0.97, 1.0), foam * 0.7);

  float alpha = clamp(mix(uAlpha, 1.0, fresnel) + foam, 0.0, 1.0);
  if (!gl_FrontFacing) {   // seen from under the water
    float c = clamp(dot(-n, v), 0.0, 1.0);
    float win = smoothstep(0.6, 0.74, c);   // Snell's window (~48°): bright surface above, mirror of the pool outside
    col = mix(vec3(0.06, 0.52, 0.66), vec3(0.78, 0.96, 1.0), win) + uLightCol * pow(max(dot(-n, normalize(v + vec3(0.0, -1.0, 0.0))), 0.0), 60.0) * 0.6;
    alpha = 0.94;
  }
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const floorFragment = /* glsl */`
uniform float uTime, uCaustics;
uniform vec3 uTile, uLine, uWaterTint;
varying vec2 vXZ;
varying float vDepth;
float caustic(vec2 p, float t) {
  vec2 q = p;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    q += vec2(sin(q.y * 1.7 + t * (0.6 + fi * 0.2)), cos(q.x * 1.5 - t * (0.5 + fi * 0.15))) * 0.45;
    c += 1.0 / (1.0 + 18.0 * abs(sin(q.x * 2.1 + q.y * 1.3)));
  }
  return c / 3.0;
}
void main() {
  // 0.25 m tiles with grout, dark lane / centre lines like a competition pool.
  vec2 g = abs(fract(vXZ / 0.25) - 0.5);
  float grout = smoothstep(0.47, 0.5, max(g.x, g.y));
  vec3 col = mix(uTile, uTile * 0.82, grout);
  float lane = (1.0 - step(0.12, abs(fract((vXZ.y + 1.25) / 2.5) - 0.5) * 2.5)) * step(abs(vXZ.x), 11.0);
  col = mix(col, uLine, lane * 0.85);
  float c = caustic(vXZ * 1.6, uTime * 1.2) * uCaustics;
  col += vec3(0.8, 0.97, 1.0) * c * 0.75;
  col = mix(col, uWaterTint, clamp(vDepth * 0.3, 0.0, 0.62));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Water {
  constructor(scene, preset) {
    this.scene = scene;
    this.rippleIdx = 0;
    const w = POOL.length + POOL.marginX * 2, d = POOL.width + POOL.marginZ * 2;
    this.half = new THREE.Vector2(w / 2, d / 2);
    this.uniforms = {
      uTime: { value: 0 }, uWave: { value: 1 }, uWaveSpeed: { value: 1 },
      uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
      uWakes: { value: Array.from({ length: MAX_WAKES }, () => new THREE.Vector4(999, 999, 0, 0)) },
      uDetail: { value: 1 }, uReflect: { value: 1 }, uFoamAmt: { value: 1 }, uAlpha: { value: WATER_PARAMS.Transparency },
      uSmooth: { value: WATER_PARAMS.SurfaceSmoothness },
      uDeep: { value: new THREE.Color(0x0a6f9e) }, uShallow: { value: new THREE.Color(0x16b6d8) },
      uSkyTop: { value: new THREE.Color(0x0a1424) }, uSkyLow: { value: new THREE.Color(0x24486a) },
      uLightCol: { value: new THREE.Color(0xfff6e6) }, uSunDir: { value: new THREE.Vector3(-0.3, 0.9, -0.4).normalize() },
      uNormalMap: { value: makeNormalMap() }, uHalf: { value: this.half },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: waterVertex, fragmentShader: waterFragment,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = null;
    this.setQuality(preset);

    // Floor + walls of the basin.
    this.floorUniforms = {
      uTime: this.uniforms.uTime, uCaustics: { value: 1 },
      uTile: { value: new THREE.Color(0x5cc9e2) }, uLine: { value: new THREE.Color(0x173f63) }, uWaterTint: { value: new THREE.Color(0x0e95c4) },
    };
    const floorMat = new THREE.ShaderMaterial({
      uniforms: this.floorUniforms,
      vertexShader: `varying vec2 vXZ; varying float vDepth; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vXZ = w.xz; vDepth = -w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: floorFragment,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), floorMat);
    floor.position.y = -POOL.depth; scene.add(floor);
    const wallMat = floorMat.clone(); wallMat.uniforms = this.floorUniforms;
    const walls = [
      [w, POOL.depth, 0, -POOL.depth / 2, -d / 2, 0], [w, POOL.depth, 0, -POOL.depth / 2, d / 2, Math.PI],
      [d, POOL.depth, -w / 2, -POOL.depth / 2, 0, Math.PI / 2], [d, POOL.depth, w / 2, -POOL.depth / 2, 0, -Math.PI / 2],
    ];
    for (const [len, h, x, y, z, ry] of walls) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat);
      m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
    }
  }

  setQuality(p) {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    const w = POOL.length + POOL.marginX * 2, d = POOL.width + POOL.marginZ * 2;
    const geo = new THREE.PlaneGeometry(w, d, p.waterSeg[0], p.waterSeg[1]).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 2;
    this.scene.add(this.mesh);
    this.uniforms.uDetail.value = p.water >= 1 ? 1 : 0;
    this.uniforms.uFoamAmt.value = p.water >= 1 ? WATER_PARAMS.FoamAmount : 0.5;
    if (this.floorUniforms) this.floorUniforms.uCaustics.value = p.water >= 1 ? WATER_PARAMS.CausticsIntensity : 0.4;
  }

  /** Impact ring (ball landing, splash, stroke...). strength ~0.3 (stroke) .. 3 (goal). */
  ripple(x, z, strength = 1) {
    const r = this.uniforms.uRipples.value[this.rippleIdx];
    r.set(x, z, this.uniforms.uTime.value, strength * WATER_PARAMS.SplashIntensity);
    this.rippleIdx = (this.rippleIdx + 1) % MAX_RIPPLES;
  }

  /** players: [{x, z, vx, vz}] (up to 14) */
  setWakes(players) {
    const arr = this.uniforms.uWakes.value;
    for (let i = 0; i < MAX_WAKES; i++) {
      const p = players[i];
      if (p) arr[i].set(p.x, p.z, p.vx, p.vz); else arr[i].set(999, 999, 0, 0);
    }
  }

  update(time) { this.uniforms.uTime.value = time; }
}

/**
 * Applies a cheap "under water" look to a standard material: below the surface the colour
 * fades toward the water tint and darkens with depth (visible through the transparent surface).
 */
/** Strength of the under-water tint (1 seen from above; low when the camera itself is under the water). */
export const UW_STRENGTH = { value: 1 };
export function underwater(material, tint = new THREE.Color(0x1f9fc4)) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uUwTint = { value: tint }; shader.uniforms.uUwK = UW_STRENGTH;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vUwY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvUwY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vUwY;\nuniform vec3 uUwTint;\nuniform float uUwK;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (vUwY < 0.0) { float k = clamp(0.22 - vUwY * 0.32, 0.0, 0.7) * uUwK; gl_FragColor.rgb = mix(gl_FragColor.rgb, uUwTint, k); }');
  };
  material.customProgramCacheKey = () => 'uw';
  return material;
}
