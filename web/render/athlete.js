// Procedural water polo athlete: articulated skeleton (pelvis, torso, neck, head, shoulders,
// upper arms, forearms, hands, thighs, shins, feet), parametric face and morphology, real cap
// with ear guards, chin strap and number, wet skin; animated by a blended procedural pose system
// (tread / eggbeater, front crawl, ball hold, shot wind-up & release, pass, block, catch IK,
// goalkeeper ready & dive, celebration, fatigue).
//
// Performance: every rigid part of a bone is merged into ONE mesh with per-vertex colour and
// roughness, and all athletes share ONE material -> ~11 draw calls per player.
import * as THREE from '../vendor/three.module.min.js';
import { UW_STRENGTH } from './water.js';

// ---------------------------------------------------------------- geometry merge helper
export function mergeParts(parts) {
  let vCount = 0, iCount = 0;
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo : p.geo.toNonIndexed();
    const m = new THREE.Matrix4().compose(p.pos || new THREE.Vector3(), p.quat || new THREE.Quaternion(), p.scale || new THREE.Vector3(1, 1, 1));
    const gg = g.clone().applyMatrix4(m);
    vCount += gg.attributes.position.count; iCount += gg.index ? gg.index.count : gg.attributes.position.count;
    return { g: gg, color: p.color, colors: p.colors, shade: p.geo.userData.shade, rough: p.rough ?? 0.4 };
  });
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), col = new Float32Array(vCount * 3), rgh = new Float32Array(vCount);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const { g, color, colors, shade, rough } of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3);
    for (let i = 0; i < n; i++) { col[(vo + i) * 3] = color.r; col[(vo + i) * 3 + 1] = color.g; col[(vo + i) * 3 + 2] = color.b; rgh[vo + i] = rough; }
    if (colors) col.set(colors, vo * 3);   // per-vertex colours (face: lips, beard, eye sockets)
    else if (shade) for (let i = 0; i < n; i++) { const k = shade[i]; col[(vo + i) * 3] *= k; col[(vo + i) * 3 + 1] *= k; col[(vo + i) * 3 + 2] *= k; }   // muscle grooves
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
    else { for (let i = 0; i < n; i++) idx[io + i] = vo + i; io += n; }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('aRough', new THREE.BufferAttribute(rgh, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

// ---------------------------------------------------------------- shared material
const SHARED = new Map();
function athleteMaterial(waterTint, rich) {
  const key = rich ? 'rich' : 'std';
  if (SHARED.has(key)) return SHARED.get(key);
  // HIGH / ULTRA: physical material with a thin clear coat = film of water on the skin and the wet suit.
  const m = rich ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 1.2, clearcoat: 1.0, clearcoatRoughness: 0.07, sheen: 0 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 1.15 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uUwTint = { value: waterTint }; sh.uniforms.uUwK = UW_STRENGTH;
    sh.uniforms.uRim = { value: new THREE.Color(0x9fd8ff).multiplyScalar(0.32) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRough;\nattribute float aMus;\nvarying float vRough;\nvarying float vMus;\nvarying vec3 vBindN;\nvarying float vUwY;\nvarying vec3 vWp;\nvarying vec3 vBind;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRough = aRough;\nvMus = aMus;\nvBindN = normal;\nvBind = position;\nvec4 wpA = modelMatrix * vec4(transformed, 1.0);\nvUwY = wpA.y;\nvWp = wpA.xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vRough; varying float vUwY; varying vec3 vWp; varying vec3 vBind; uniform vec3 uUwTint; uniform vec3 uRim; uniform float uUwK;
        varying float vMus; varying vec3 vBindN;
        float g1(float d, float s) { return exp(-d * d / (s * s)); }
        // Muscle definition (metres, bind pose): pectoral plateau with a sharp lower edge, sternum groove,
        // six-pack (linea alba + 3 tendinous lines), oblique V, deltoid separation, serratus, spine and
        // shoulder blades. Bump-mapped per pixel: crisp shadows without extra triangles.
        float muscleH(vec3 p, vec3 n) {
          float ax = abs(p.x), fr = smoothstep(0.1, 0.5, n.z), bk = smoothstep(0.1, 0.5, -n.z), h = 0.0;
          float pec = smoothstep(0.01, 0.035, ax) * (1.0 - smoothstep(0.15, 0.2, ax)) * smoothstep(-0.105, -0.075, p.y) * (1.0 - smoothstep(0.0, 0.07, p.y));
          h += fr * pec * 0.006 - fr * g1(p.x, 0.008) * smoothstep(-0.12, -0.08, p.y) * (1.0 - smoothstep(0.03, 0.07, p.y)) * 0.002;
          float absM = fr * (1.0 - smoothstep(0.07, 0.09, ax)) * smoothstep(-0.4, -0.36, p.y) * (1.0 - smoothstep(-0.13, -0.1, p.y));
          float rows = g1(p.y + 0.17, 0.007) + g1(p.y + 0.23, 0.007) + g1(p.y + 0.295, 0.008);
          h += absM * (0.004 - 0.0045 * g1(p.x, 0.007) - 0.003 * rows);
          h -= fr * g1(ax - 0.1 - (p.y + 0.25) * 0.15, 0.012) * smoothstep(-0.44, -0.36, p.y) * (1.0 - smoothstep(-0.15, -0.1, p.y)) * 0.003;
          float dd = length(vec3(ax, p.y, p.z) - vec3(0.231, 0.07, 0.075));
          h += 0.004 * (1.0 - smoothstep(0.04, 0.085, dd)) - 0.002 * g1(dd - 0.088, 0.009);
          h += smoothstep(0.4, 0.8, abs(n.x)) * smoothstep(-0.15, -0.11, p.y) * (1.0 - smoothstep(-0.03, 0.01, p.y)) * 0.0013 * sin(p.y * 130.0 - ax * 30.0);
          h -= bk * g1(p.x, 0.011) * smoothstep(-0.46, -0.36, p.y) * (1.0 - smoothstep(0.08, 0.14, p.y)) * 0.003;
          h += bk * exp(-(pow((ax - 0.09) / 0.05, 2.0) + pow((p.y + 0.01) / 0.07, 2.0))) * 0.0035;
          return h;
        }
        float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        vec3 bumpN(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
          vec3 vSigmaX = dFdx(surf_pos.xyz), vSigmaY = dFdy(surf_pos.xyz), vN = surf_norm;
          vec3 R1 = cross(vSigmaY, vN), R2 = cross(vN, vSigmaX); float fDet = dot(vSigmaX, R1) * faceDir;
          vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2); return normalize(abs(fDet) * surf_norm - vGrad); }`)
      // Skin detail on the bind pose (it does not swim with the animation): pores, fine relief and
      // water droplets (raised, glossy), only on skin (the cap and the suit have other roughness values).
      .replace('#include <roughnessmap_fragment>', `float skinK = 1.0 - step(0.345, vRough);
        // fade each detail layer out when it gets smaller than a pixel (no shimmer at match distance)
        float px = length(fwidth(vBind));
        float aP = 1.0 - smoothstep(0.15, 0.5, px * 300.0), aD = 1.0 - smoothstep(0.2, 0.6, px * 60.0);
        float hPore = (vnoise(vBind * 300.0) - 0.5) * aP;
        float dn = vnoise(vBind * 45.0 + 7.3), drop = smoothstep(0.9, 0.97, dn) * step(0.0, vUwY) * aD;
        float hSkin = (hPore * 0.5 + drop * 0.9) * skinK;
        float hMus = vMus > 0.5 ? muscleH(vBind, normalize(vBindN)) * skinK : 0.0;
        float roughnessFactor = clamp(vRough + hPore * 0.08 * skinK - drop * 0.22 * skinK, 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumpN(-vViewPosition, normal, vec2(dFdx(hSkin), dFdy(hSkin)) * 0.0011 + vec2(dFdx(hMus), dFdy(hMus)) * 1.6, faceDirection);`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
        gl_FragColor.rgb += uRim * fr * (vUwY > 0.0 ? 1.0 : 0.25);   // rim light: detaches the athlete from the background
        if (vUwY < 0.0) { float k = clamp(0.3 - vUwY * 0.5, 0.0, 0.85) * uUwK; gl_FragColor.rgb = mix(gl_FragColor.rgb, uUwTint, k); }`);
  };
  m.customProgramCacheKey = () => 'athlete-' + key;
  SHARED.set(key, m);
  return m;
}

// ---------------------------------------------------------------- scanned head (HIGH / ULTRA, portraits)
// Real 3D head scan "Lee Perry-Smith" by Infinite-Realities, licence Creative Commons Attribution 3.0
// (web/assets/head/LICENSE.txt), cropped under the cap and re-shaped per player (face width, jaw,
// nose, chin, brow, lips), tinted to the player's skin tone, beard painted per player.
let HEAD = null;
export async function loadScanHead(base = 'web/assets/head/') {
  if (HEAD) return HEAD;
  const buf = await (await fetch(base + 'head.bin')).arrayBuffer(), dv = new DataView(buf);
  const n = dv.getUint32(0, true), ni = dv.getUint32(4, true); let o = 8;
  const pos = new Float32Array(buf, o, n * 3); o += n * 12;
  const nor = new Float32Array(buf, o, n * 3); o += n * 12;
  const uv = new Float32Array(buf, o, n * 2); o += n * 8;
  const idx = new Uint16Array(buf, o, ni);
  const tl = new THREE.TextureLoader(), load = (f, srgb) => new Promise((res, rej) => tl.load(base + f, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; res(t); }, undefined, rej));
  const [map, normalMap, roughnessMap] = await Promise.all([load('skin_col.jpg', true), load('skin_nrm.jpg'), load('skin_rgh.jpg')]);
  HEAD = { pos, nor, uv, idx, map, normalMap, roughnessMap, mats: new Map() };
  return HEAD;
}
export const scanHeadReady = () => !!HEAD;
/** Motion-captured clips retargeted to this rig (web/assets/anim, see tools/anim): joint values per frame. */
const CLIPS = {};
export async function loadAnimations(base = 'web/assets/anim/') {
  const c = await (await fetch(base + 'treading.json')).json();
  CLIPS.treading = c; return CLIPS;
}
/** Clip pose at cycle position u (0..1, looping), linear between frames. */
function sampleClip(c, u, out) {
  const n = c.frames.length, x = (((u % 1) + 1) % 1) * n, i = Math.floor(x) % n, f = x - Math.floor(x), A = c.frames[i], B = c.frames[(i + 1) % n];
  for (let k = 0; k < c.keys.length; k++) out[c.keys[k]] = A[k] + (B[k] - A[k]) * f;
  return out;
}

/**
 * Muscle volume (bind pose, metres, y up, z forward): each vertex is pushed along its normal by smooth
 * muscle bellies placed from the build's joints (pectorals, deltoids, trapezius, latissimus, shoulder
 * blades, biceps / triceps, forearms, quadriceps, calves). Water polo players' upper body is massive.
 */
function muscleVolume(P, N, J) {
  const g = (d, s) => Math.exp(-(d * d) / (s * s));
  const seg = (x, y, z, a, b) => {   // distance to segment a-b and position along it
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], l2 = abx * abx + aby * aby + abz * abz;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / l2));
    return [Math.hypot(x - a[0] - abx * t, y - a[1] - aby * t, z - a[2] - abz * t), t];
  };
  const sh = J['l-shoulder'], el = J['l-elbow'], ha = J['l-hand'], hip = J['l-upper-leg'], kn = J['l-knee'], an = J['l-ankle'];
  for (let i = 0; i < P.length; i += 3) {
    const x0 = P[i], y = P[i + 1], z = P[i + 2], x = Math.abs(x0), nx = N[i], ny = N[i + 1], nz = N[i + 2];
    const front = Math.max(0, nz), back = Math.max(0, -nz);
    let d = 0;
    // torso (above the hips, inside the shoulders)
    if (x < sh[0] + 0.04 && y > hip[1]) {
      d += 0.011 * front * g(x - 0.095, 0.07) * g(y - (sh[1] - 0.08), 0.06);                 // pectorals
      d += 0.012 * g(Math.hypot(x - 0.12, y - (sh[1] + 0.07)), 0.06) * (0.4 + 0.6 * back) * Math.max(0, ny + 0.3);   // trapezius
      d += 0.010 * back * g(x - 0.13, 0.06) * g(y - (sh[1] - 0.17), 0.1);                    // latissimus (V back)
      d += 0.006 * back * g(x - 0.085, 0.05) * g(y - (sh[1] - 0.06), 0.06);                  // shoulder blades
      d += 0.007 * Math.abs(nx) * g(y - (sh[1] - 0.15), 0.08) * g(x - 0.14, 0.05);           // lats seen from the front
    }
    // deltoid cap
    const dd = Math.hypot(x - sh[0], y - sh[1], z - sh[2]);
    d += 0.013 * g(dd - 0.045, 0.04) * Math.max(0.2, 1 - Math.max(0, -ny));
    // upper arm: biceps (front), triceps (back); forearm
    if (x > sh[0] - 0.03) {
      const [ru, tu] = seg(x, y, z, sh, el); if (ru < 0.07) d += (0.008 * g(tu - 0.55, 0.25) * (0.5 + 0.5 * front) + 0.006 * g(tu - 0.4, 0.25) * back) * (1 - ru / 0.07);
      const [rf, tf] = seg(x, y, z, el, ha); if (rf < 0.06) d += 0.006 * g(tf - 0.25, 0.2) * (1 - rf / 0.06);
    }
    // legs: quadriceps, hamstrings, calves
    if (y < hip[1] + 0.02) {
      const [rq, tq] = seg(x, y, z, hip, kn); if (rq < 0.1) d += (0.009 * g(tq - 0.45, 0.28) * (0.4 + 0.6 * front) + 0.005 * g(tq - 0.85, 0.08) * front * g(x0 * Math.sign(x0) - kn[0] + 0.03, 0.04)) * (1 - rq / 0.1);
      const [rc, tc] = seg(x, y, z, kn, an); if (rc < 0.08) d += 0.008 * g(tc - 0.28, 0.16) * (0.3 + 0.7 * back) * (1 - rc / 0.08);
    }
    P[i] += nx * d; P[i + 1] += ny * d; P[i + 2] += nz * d;
  }
}

// ---------------------------------------------------------------- scanned-quality body (HIGH / ULTRA, portraits)
// MakeHuman base mesh hm08 (CC0 1.0) morphed with its male / muscle / weight targets into 3 builds
// (lean, athletic, massive), head removed (the scanned head replaces it), skinned offline to this
// skeleton (tools/assets/prep_body.mjs). Joints come from the MakeHuman joint helpers.
let BODY = null;
export async function loadScanBody(base = 'web/assets/body/') {
  if (BODY) return BODY;
  const [hdr, buf] = await Promise.all([fetch(base + 'body.json').then((r) => r.json()), fetch(base + 'body.bin').then((r) => r.arrayBuffer())]);
  const { nv, ni } = hdr; let o = 0;
  const index = new THREE.BufferAttribute(new Uint16Array(buf, o, ni), 1); o += ni * 2; o += (4 - (o % 4)) % 4;
  const pos = [], nor = [];
  for (let v = 0; v < hdr.variants.length; v++) {
    const a = new Float32Array(buf.slice(o, o + nv * 12)); o += nv * 12;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setIndex(index); g.computeVertexNormals();
    muscleVolume(a, g.attributes.normal.array, hdr.joints[hdr.variants[v]] || hdr.joints.athletic);   // water polo athlete: pecs, delts, lats, traps, arms, thighs
    g.computeVertexNormals();
    pos.push(g.attributes.position); nor.push(g.attributes.normal);
  }
  const b4 = new Uint8Array(buf, o, nv * 4); o += nv * 4;
  const w4 = new Float32Array(buf.slice(o, o + nv * 16)); o += nv * 16; const suit = new Uint8Array(buf, o, nv); o += nv; const ao = new Uint8Array(buf, o, nv);
  BODY = { ...hdr, index, pos, nor, b4, w4, suit, ao };
  return BODY;
}
const BUILD = { SMALL_FAST: 'lean', SLIM: 'lean', ATHLETIC: 'athletic', TALL_POWER: 'power', MASSIVE: 'massive' };
/** Colour multiplier of the scanned face texture for a skin tone (per channel, partly luminance only so
 *  lips and cheeks keep natural hues). The body uses SCAN_REF × this tint: face and body match. */
function scanTint(skin) {
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, kl = lum(skin) / lum(SCAN_REF);
  return new THREE.Color(skin.r / SCAN_REF.r, skin.g / SCAN_REF.g, skin.b / SCAN_REF.b).lerp(new THREE.Color(kl, kl, kl), 0.6).multiplyScalar(1.16);
}
const TILT_C = Math.cos(0.18), TILT_S = Math.sin(0.18), EYE_U = [0.447, 0.568], EYE_V = 0.711;
const SCAN_REF = new THREE.Color(0.51, 0.294, 0.248);   // average skin colour of the scan texture (linear)
function headMaterial(waterTint, rich) {
  const key = rich ? 'rich' : 'std';
  if (HEAD.mats.has(key)) return HEAD.mats.get(key);
  const P = { vertexColors: true, map: HEAD.map, normalMap: HEAD.normalMap, roughnessMap: HEAD.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 1.0 };
  const m = rich ? new THREE.MeshPhysicalMaterial({ ...P, clearcoat: 0.6, clearcoatRoughness: 0.16, sheen: 0.25, sheenColor: new THREE.Color(0xff9a80), sheenRoughness: 0.6 }) : new THREE.MeshStandardMaterial(P);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uUwTint = { value: waterTint }; sh.uniforms.uUwK = UW_STRENGTH; sh.uniforms.uRim = { value: new THREE.Color(0x9fd8ff).multiplyScalar(0.28) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUwY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvUwY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUwY;\nuniform vec3 uUwTint;\nuniform vec3 uRim;\nuniform float uUwK;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
        gl_FragColor.rgb += uRim * fr * (vUwY > 0.0 ? 1.0 : 0.25);
        if (vUwY < 0.0) { float k = clamp(0.3 - vUwY * 0.5, 0.0, 0.85) * uUwK; gl_FragColor.rgb = mix(gl_FragColor.rgb, uUwTint, k); }`);
  };
  m.customProgramCacheKey = () => 'scanhead-' + key;
  HEAD.mats.set(key, m);
  return m;
}
/** Per-player scanned head geometry (head bone space). */
function scanHeadGeometry(P, skin, hair) {
  const s = 0.0556, n = HEAD.pos.length / 3, pos = new Float32Array(HEAD.pos), col = new Float32Array(n * 3), eyeAcc = [[], []];
  const toHead = (X, Y, Z) => { const hx = (X + 0.08) * s, hy = (Y + 0.5) * s - 0.03 - 0.08, hz = (Z - 0.25) * s; return [hx, hy * TILT_C - hz * TILT_S + 0.08, hy * TILT_S + hz * TILT_C]; };
  // Skin tone: per-channel ratio to the scan's tone, partly replaced by a luminance ratio so the lips
  // and cheeks keep natural hues on every skin tone.
  const tint = scanTint(skin), hairT = new THREE.Color(hair.r / SCAN_REF.r, hair.g / SCAN_REF.g, hair.b / SCAN_REF.b).multiplyScalar(0.8), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    // scan units (y up, z forward): eyes ~ 1.6, nose tip (0, 1.1, 2.6), mouth ~ 0.35, chin ~ -0.45
    // Eye openings (the scan has closed lids): almond-shaped area of each eye, found in texture space,
    // pushed into the head and darkened; real eyeballs are placed behind it.
    const u = HEAD.uv[i * 2], v = HEAD.uv[i * 2 + 1];
    let aw = 0;
    for (const u0 of EYE_U) { const r = ((u - u0) / 0.027) ** 2 + ((v - EYE_V) / 0.0088) ** 2; aw = Math.max(aw, sstep(1.0, 0.55, r)); }
    let X = pos[i * 3] / s - 0.08, Y = (pos[i * 3 + 1] + 0.03) / s - 0.5, Z = pos[i * 3 + 2] / s + 0.25;
    const f = sstep(0.4, 1.8, Z), ax = Math.abs(X);
    X *= P.faceW * (1 - (1 - P.jawW) * sstep(1.0, -0.6, Y) * f);                                   // face, jaw width
    // variations around the scan (0 = the scanned face): nose, chin, brow ridge, lips
    const dn = (P.nose - 0.16) * 3, dc = (P.chin - 0.055) * 5, db = (P.brow - 0.052) * 5, dl = (P.lips - 0.032) * 2;
    Z += f * (dn * gs(X, 0.4) * gs(Y - 1.0, 0.5) + dc * gs(Y + 0.45, 0.4) * gs(X, 0.9) + db * gs(Y - 2.0, 0.25) * gs(X, 1.2) + dl * gs(Y - 0.35, 0.2) * gs(X, 0.6));
    Y -= dc * 2 * sstep(0.2, -0.6, Y) * f;                                                         // longer / shorter chin
    if (aw > 0.5) eyeAcc[X < 0 ? 0 : 1].push([X, Y, Z]);
    Z -= aw * 0.22;
    // back to head space, pitched forward a little (the scan looks slightly up)
    const hx = (X + 0.08) * s, hy = (Y + 0.5) * s - 0.03 - 0.08, hz = (Z - 0.25) * s;
    pos[i * 3] = hx; pos[i * 3 + 1] = hy * TILT_C - hz * TILT_S + 0.08; pos[i * 3 + 2] = hy * TILT_S + hz * TILT_C;
    // colour multiplier: skin tone; beard / moustache / goatee darken toward the hair colour
    const beard = f * sstep(0.75, -0.1, Y) * (1 - gs(Y - 0.35, 0.16) * gs(X, 0.55)) * sstep(2.0, 1.2, ax);
    const must = f * gs(Y - 0.62, 0.13) * gs(X, 0.6), goat = f * gs(Y + 0.25, 0.35) * gs(X, 0.45);
    c.copy(tint).lerp(hairT, Math.min(1, beard * P.beard * 0.6 + must * P.moustache + goat * P.goatee)).multiplyScalar(1 - 0.88 * aw);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(HEAD.uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(HEAD.idx, 1));
  // eye centres (head space): middle of each opening, on the lid surface
  g.userData.eyes = eyeAcc.map((L) => { const m = [0, 0, 0]; for (const p of L) { m[0] += p[0] / L.length; m[1] += p[1] / L.length; m[2] = Math.max(m[2], p[2]); } return toHead(m[0], m[1], m[2]); });
  return weldNormals(g);
}

// ---------------------------------------------------------------- appearance
const SKIN = [0xdcaa84, 0xcf9a72, 0xbd845d, 0xa86d47, 0x7c4e31, 0x5a3622];   // tanned (outdoor training) to dark
const HAIR = [0x1d140f, 0x3a2818, 0x5b3b1f, 0x8a6236, 0xc9a26b, 0x2a2a2a];
const C = (hex) => new THREE.Color(hex);

function rng(seed) {
  let s = seed >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0; s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0; s = (s ^ (s >>> 16)) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Body types: silhouette (height, shoulders, muscle bulk, waist) and animation (tempo, amplitude). */
export const BODY_TYPES = {
  SMALL_FAST: { height: 0.95, shoulders: 0.96, bulk: 0.92, waist: 0.95, tempo: 1.12, amp: 1.1 },
  TALL_POWER: { height: 1.07, shoulders: 1.09, bulk: 1.07, waist: 1.0, tempo: 0.93, amp: 0.95 },
  ATHLETIC: { height: 1.0, shoulders: 1.03, bulk: 1.0, waist: 0.97, tempo: 1.0, amp: 1.0 },
  MASSIVE: { height: 1.02, shoulders: 1.13, bulk: 1.18, waist: 1.1, tempo: 0.88, amp: 0.9 },
  SLIM: { height: 1.01, shoulders: 0.95, bulk: 0.88, waist: 0.92, tempo: 1.06, amp: 1.05 },
};
const ROLE_TYPES = { GOALKEEPER: ['TALL_POWER', 'ATHLETIC', 'TALL_POWER'], CENTER: ['MASSIVE', 'TALL_POWER', 'MASSIVE'], DEFENDER: ['TALL_POWER', 'MASSIVE', 'ATHLETIC'],
  WINGER: ['SMALL_FAST', 'SLIM', 'ATHLETIC'], PLAYMAKER: ['ATHLETIC', 'SLIM', 'SMALL_FAST'], FINISHER: ['ATHLETIC', 'TALL_POWER', 'SLIM'], ALL_ROUNDER: ['ATHLETIC', 'SLIM', 'TALL_POWER'] };

/** Morphology from role + seed: body type, height, shoulder width, bulk, waist, animation tempo. */
export function morphology(role, seed) {
  const r = rng(seed * 7919 + 13);
  const list = ROLE_TYPES[role] || ROLE_TYPES.ALL_ROUNDER, type = list[Math.floor(r() * list.length)], b = BODY_TYPES[type];
  const gk = role === 'GOALKEEPER' ? 0.03 : 0;
  return { type, height: b.height + gk + (r() - 0.5) * 0.05, shoulders: b.shoulders + (r() - 0.5) * 0.05, bulk: b.bulk + (r() - 0.5) * 0.06,
    waist: b.waist + (r() - 0.5) * 0.04, tempo: b.tempo, amp: b.amp };
}

export const HAIR_STYLES = ['shaved', 'short', 'curly', 'wavy', 'long'];

// ---------------------------------------------------------------- sculpting
const gs = (d, w) => Math.exp(-(d / w) * (d / w));
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Normals averaged across duplicated vertices (lathe / sphere seams and poles) -> no visible seam. */
function weldNormals(g) {
  g.computeVertexNormals();
  const p = g.attributes.position.array, n = g.attributes.normal.array, acc = new Map();
  const key = (i) => `${Math.round(p[i * 3] * 1e5)},${Math.round(p[i * 3 + 1] * 1e5)},${Math.round(p[i * 3 + 2] * 1e5)}`;
  for (let i = 0; i < p.length / 3; i++) {
    const k = key(i), a = acc.get(k);
    if (a) { a[0] += n[i * 3]; a[1] += n[i * 3 + 1]; a[2] += n[i * 3 + 2]; } else acc.set(k, [n[i * 3], n[i * 3 + 1], n[i * 3 + 2]]);
  }
  for (let i = 0; i < p.length / 3; i++) {
    const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1;
    n[i * 3] = a[0] / l; n[i * 3 + 1] = a[1] / l; n[i * 3 + 2] = a[2] / l;
  }
  return g;
}

/**
 * Muscle body part: smooth lathe through [radius, y] keys (bottom -> top), seam at the back,
 * then sculpt(v) moves each vertex (muscle bulges, grooves). z+ = front of the body.
 */
function sculptLathe(keys, rows, segs, sculpt, shadeFn) {
  const pts = new THREE.SplineCurve(keys.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(rows);
  pts[0].x = 0; pts[pts.length - 1].x = 0;
  for (const q of pts) q.x = Math.max(0, q.x);
  const g = new THREE.LatheGeometry(pts, segs, Math.PI);
  if (sculpt) {
    const a = g.attributes.position.array, v = new THREE.Vector3();
    const sh = shadeFn ? new Float32Array(a.length / 3) : null;
    for (let i = 0; i < a.length; i += 3) {
      v.set(a[i], a[i + 1], a[i + 2]); if (sh) sh[i / 3] = shadeFn(v);
      sculpt(v); a[i] = v.x; a[i + 1] = v.y; a[i + 2] = v.z;
    }
    if (sh) g.userData.shade = sh;   // colour multiplier (painted ambient occlusion of the muscle grooves)
  }
  return weldNormals(g);
}

/**
 * Sculpted head (unit sphere displaced): long lower face, jaw, chin, cheekbones, brow ridge,
 * eye sockets, nose bridge and tip, lips. Returns geometry in unit space + per-vertex colours.
 */
function sculptHead(ws, hs, P, skin, hair) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const a = g.attributes.position.array, cols = new Float32Array(a.length);
  const flush = skin.clone().lerp(C(0xc0504a), 0.3), lip = skin.clone().lerp(C(0x9c4a46), 0.45), socket = skin.clone().multiplyScalar(0.8), dark = skin.clone().multiplyScalar(0.72), c = new THREE.Color();
  for (let i = 0; i < a.length; i += 3) {
    let x = a[i], y = a[i + 1], z = a[i + 2];
    const f = sstep(-0.2, 0.75, z);                                   // 0 back of the skull .. 1 face
    if (y < 0) y *= 1 + 0.3 * f;                                      // longer lower face
    x *= P.faceW * (1 - (1 - P.jawW) * sstep(0.05, -0.9, y) * (0.4 + 0.6 * f));   // face and jaw width
    if (z < 0) z *= 0.95;
    const top = 1 - 0.05 * sstep(0.4, 0.9, y); x *= top; y *= top; z *= top;   // stays under the cap
    const ax = Math.abs(x), sx = Math.sign(x);
    const nose = P.nose * gs(x, P.noseW) * (y > -0.12 ? sstep(0.32, -0.12, y) : gs(y + 0.12, 0.06));
    const eye = gs(y - 0.15, 0.1) * gs(ax - 0.36, 0.13);
    const lips = gs(y + 0.42, 0.06) * gs(x, 0.2);
    z += f * (P.brow * gs(y - 0.33, 0.09) * gs(x, 0.5) - 0.07 * eye + 0.035 * gs(y + 0.05, 0.14) * gs(ax - 0.5, 0.14)
      + nose + P.lips * lips - 0.018 * gs(y + 0.56, 0.05) * gs(x, 0.16) + P.chin * gs(y + 0.86, 0.12) * gs(x, 0.26));
    x += sx * (0.04 * gs(y + 0.05, 0.15) * gs(z - 0.5, 0.25) - 0.035 * gs(y + 0.42, 0.15) * gs(z - 0.45, 0.25));
    a[i] = x; a[i + 1] = y; a[i + 2] = z;
    // colour: sockets & under-chin shading (cheap ambient occlusion), lips, beard / stubble
    const hsh = Math.sin(i * 12.9898 + P.seed) * 43758.5453, nz = (hsh - Math.floor(hsh) - 0.5) * 0.05;   // tone variation
    c.copy(skin).multiplyScalar(1 + nz).lerp(flush, f * (0.22 * gs(y + 0.12, 0.16) * gs(ax - 0.5, 0.2) + 0.25 * gs(y + 0.08, 0.1) * gs(x, 0.1))).lerp(socket, f * gs(y - 0.12, 0.1) * gs(ax - 0.3, 0.16) * 0.9).lerp(dark, sstep(-0.75, -1.1, y) * 0.6);
    c.lerp(lip, f * gs(y + 0.42, 0.045) * gs(x, 0.15) * 0.95);
    const beardZone = f * sstep(-0.22, -0.5, y) * (1 - gs(y + 0.42, 0.05) * gs(x, 0.17)) * sstep(0.95, 0.6, ax + 0.4 * (1 - f));
    c.lerp(hair, beardZone * P.beard);
    c.lerp(hair, f * gs(y + 0.31, 0.045) * gs(x, 0.17) * P.moustache);                   // moustache
    c.lerp(hair, f * gs(y + 0.8, 0.13) * gs(x, 0.14) * P.goatee);                         // goatee
    cols[i] = c.r; cols[i + 1] = c.g; cols[i + 2] = c.b;
  }
  return { geo: weldNormals(g), colors: cols };
}

/** Per-vertex colours from fn(position, colour). */
function paint(geo, fn) {
  const a = geo.attributes.position.array, out = new Float32Array(a.length), v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < a.length; i += 3) { v.set(a[i], a[i + 1], a[i + 2]); fn(v, c); out[i] = c.r; out[i + 1] = c.g; out[i + 2] = c.b; }
  return out;
}

// ---------------------------------------------------------------- water polo cap
/**
 * Fitted water polo cap (reference: real caps): fabric shrink-wrapped on the actual head surface (radius
 * found per direction from the head vertices, smoothed like stretched fabric), covering the skull, the
 * nape and coming down in flaps over the ears to the jaw; rolled binding along the edge, seam over the
 * top; oval domed ear guards with a grid of holes; strings tied under the chin with dangling ends.
 * All in head-bone space. Returns parts for mergeParts + a surface() helper to place numbers.
 */
function buildCap(headGeo, o) {
  const C0 = new THREE.Vector3(0, 0.1, -0.005), NA = o.res * 2, NT = o.res;   // azimuth x polar grid
  const T0 = 0.0, T1 = Math.PI * 0.74;
  // head radius per direction (bucketed vertices; the scanned head is cropped on top -> ellipsoid fallback)
  const P = headGeo.attributes.position.array, raw = new Float32Array((NA) * (NT + 1)).fill(0), d = new THREE.Vector3();
  for (let i = 0; i < P.length; i += 3) {
    d.set(P[i] - C0.x, P[i + 1] - C0.y, P[i + 2] - C0.z); const r = d.length(); if (r < 1e-4) continue; d.multiplyScalar(1 / r);
    const t = Math.acos(clamp(d.y, -1, 1)); if (t > T1 + 0.1) continue;
    const a = Math.atan2(d.x, d.z);
    const ia = ((Math.round((a / (Math.PI * 2)) * NA) % NA) + NA) % NA, it = Math.round(((t - T0) / (T1 - T0)) * NT);
    if (it < 0 || it > NT) continue;
    const k = it * NA + ia; if (r > raw[k]) raw[k] = r;
  }
  const E = o.ell, R = new Float32Array(raw.length);
  for (let it = 0; it <= NT; it++) for (let ia = 0; ia < NA; ia++) {
    const t = T0 + (it / NT) * (T1 - T0), a = (ia / NA) * Math.PI * 2;
    const dx = Math.sin(t) * Math.sin(a), dy = Math.cos(t), dz = Math.sin(t) * Math.cos(a);
    const re = 1 / Math.sqrt((dx / E[0]) ** 2 + (dy / E[1]) ** 2 + (dz / E[2]) ** 2);
    const k = it * NA + ia; R[k] = raw[k] > 0 ? raw[k] : re;
  }
  const minR = R.slice();
  for (let pass = 0; pass < 6; pass++) {   // fabric: smooth over the bumps (ears, hair line), never inside the head
    const Q = R.slice();
    for (let it = 0; it <= NT; it++) for (let ia = 0; ia < NA; ia++) {
      const k = it * NA + ia, l = it * NA + (ia + NA - 1) % NA, rr = it * NA + (ia + 1) % NA, u = Math.max(0, it - 1) * NA + ia, w = Math.min(NT, it + 1) * NA + ia;
      R[k] = Math.max(minR[k], (Q[k] * 2 + Q[l] + Q[rr] + Q[u] + Q[w]) / 6);
    }
  }
  // cap outline: straight across the forehead, down in front of the ears to the jaw, around the nape
  const edgeY = (a) => { const A = Math.abs(a); return A < 0.5 ? 0.163 : A < 1.3 ? 0.163 - 0.145 * sstep(0.5, 1.3, A) : 0.018 + 0.012 * sstep(2.2, Math.PI, A); };
  const pos = [], col = [], idx = [], grid = new Int32Array((NT + 1) * NA).fill(-1), c = new THREE.Color();
  const pt = (it, ia, extra = 0) => {
    const t = T0 + (it / NT) * (T1 - T0), a = (ia / NA) * Math.PI * 2, r = R[it * NA + ia] + o.thick + extra;
    return [C0.x + r * Math.sin(t) * Math.sin(a), C0.y + r * Math.cos(t), C0.z + r * Math.sin(t) * Math.cos(a)];
  };
  for (let it = 0; it <= NT; it++) for (let ia = 0; ia < NA; ia++) {
    const a = (ia / NA) * Math.PI * 2, aa = a > Math.PI ? a - 2 * Math.PI : a, p0 = pt(it, ia), m = p0[1] - edgeY(aa);
    let v = p0;
    if (m < 0) {
      // first row below the outline: snap it onto the outline (smooth edge instead of a staircase)
      if (it === 0) continue;
      const pp = pt(it - 1, ia), mp = pp[1] - edgeY(aa); if (mp < 0) continue;
      const f = mp / (mp - m);
      v = [pp[0] + (p0[0] - pp[0]) * f, pp[1] + (p0[1] - pp[1]) * f, pp[2] + (p0[2] - pp[2]) * f];
    }
    const band = m < 0.009;   // rolled binding along the edge
    if (band) { const n0 = new THREE.Vector3(...v).sub(C0).normalize().multiplyScalar(0.0018); v = [v[0] + n0.x, v[1] + n0.y, v[2] + n0.z]; }
    grid[it * NA + ia] = pos.length / 3; pos.push(...v);
    c.copy(band ? o.trim : o.cap);
    if (!band && Math.abs(Math.sin(aa)) * Math.sin(T0 + (it / NT) * (T1 - T0)) < 0.012 && Math.cos(aa) > -0.2 || (!band && Math.abs(aa) > Math.PI - 0.03)) c.copy(o.cap).lerp(o.trim, 0.55);   // top seam
    col.push(c.r, c.g, c.b);
  }
  for (let it = 0; it < NT; it++) for (let ia = 0; ia < NA; ia++) {
    const a = grid[it * NA + ia], b = grid[it * NA + (ia + 1) % NA], cc = grid[(it + 1) * NA + ia], dd = grid[(it + 1) * NA + (ia + 1) % NA];
    if (a >= 0 && b >= 0 && cc >= 0) idx.push(a, cc, b);
    if (b >= 0 && cc >= 0 && dd >= 0) idx.push(b, cc, dd);
  }
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cap.setIndex(idx); cap.computeVertexNormals();
  const parts = [{ geo: cap, colors: new Float32Array(col), color: o.cap, rough: o.rough }];
  // surface point + normal for an azimuth / height (numbers, ear guards, strings)
  const surface = (a, y, extra = 0) => {
    let best = null, bd = 9;
    for (let it = 0; it <= NT; it++) { const p = pt(it, ((Math.round((a / (Math.PI * 2)) * NA) % NA) + NA) % NA, extra); const dy = Math.abs(p[1] - y); if (dy < bd) { bd = dy; best = p; } }
    const v = new THREE.Vector3(...best), n = v.clone().sub(C0).normalize(); return { p: v, n };
  };
  // ear guards: oval domes over the ears, grid of holes (vertex colours), rim
  for (const sx of [-1, 1]) {
    const { p, n } = surface(sx * Math.PI * 0.5 - sx * 0.08, 0.082, 0.006);
    const g = new THREE.SphereGeometry(0.04, o.res + 8, Math.max(8, (o.res >> 1) + 4), 0, Math.PI * 2, 0, Math.PI * 0.42);
    const gp = g.attributes.position.array, gc = new Float32Array(gp.length);
    for (let i = 0; i < gp.length; i += 3) {
      const x = gp[i], z = gp[i + 2], hole = Math.abs(Math.sin(x * 330)) > 0.55 && Math.abs(Math.sin(z * 330)) > 0.55 && Math.hypot(x, z) < 0.022;
      c.copy(o.guard); if (hole) c.multiplyScalar(0.18); if (Math.hypot(x, z) > 0.024) c.multiplyScalar(0.85);
      gc[i] = c.r; gc[i + 1] = c.g; gc[i + 2] = c.b;
    }
    const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
    parts.push({ geo: g, colors: gc, color: o.guard, rough: 0.35, pos: p.clone().addScaledVector(n, -0.03), quat: q, scale: new THREE.Vector3(0.95, 0.75, 1.2) });
  }
  // strings: from the bottom of each flap, under the chin, bow and two loose ends
  if (o.strings) {
    const knot = new THREE.Vector3(0, -0.035, 0.07);
    for (const sx of [-1, 1]) {
      const { p } = surface(sx * 1.32, 0.03, 0.001);
      const pts = [p, new THREE.Vector3(sx * 0.06, -0.01, 0.06), knot.clone().add(new THREE.Vector3(sx * 0.008, 0, 0))];
      parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.0022, 4), color: o.trim, rough: 0.6 });
      const end = [knot.clone(), new THREE.Vector3(sx * 0.012, -0.07, 0.075), new THREE.Vector3(sx * 0.02, -0.11, 0.07)];
      parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(end), 8, 0.002, 4), color: o.trim, rough: 0.6 });
      parts.push({ geo: new THREE.TorusGeometry(0.009, 0.0022, 4, 8), color: o.trim, rough: 0.6, pos: knot.clone().add(new THREE.Vector3(sx * 0.011, 0, 0.003)), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, sx * 0.4, 0)) });
    }
  }
  return { parts, surface };
}

/** z of the head surface (front) at (x, y), from the generated vertices: features sit ON the face. */
function surfaceZ(geo, x, y) {
  const p = geo.attributes.position.array; let best = [], bz = 0;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i + 2] <= 0) continue;
    const d = Math.hypot(p[i] - x, p[i + 1] - y);
    best.push([d, p[i + 2]]);
  }
  best.sort((u, v) => u[0] - v[0]); best = best.slice(0, 4);
  let wsum = 0; for (const [d, z] of best) { const w = 1 / (d + 1e-4); wsum += w; bz += z * w; }
  return bz / wsum;
}

function concatPlanes(list) {
  const pos = [], uv = [], idx = []; let o = 0;
  for (const g of list) { pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); for (const i of g.index.array) idx.push(i + o); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(idx); return out;
}
function numberTexture(n, fg = '#ffffff') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '800 46px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(String(n), 32, 35);
  g.fillStyle = fg; g.fillText(String(n), 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- athlete
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0), IDQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const THROW_DUR = { pass: 0.36, shot: 0.7, power: 0.75, lob: 0.55 };   // whip + follow-through (shot ~0.25 s whip, then the fall forward)
const JOINTS = ['chestX', 'chestY', 'chestZ', 'pelvisY', 'pelvisZ', 'pitch', 'roll', 'twist', 'neck', 'headX', 'headY', 'shRx', 'shRz', 'shRy', 'elR', 'shLx', 'shLz', 'shLy', 'elL', 'hipRx', 'hipRz', 'knR', 'knRy', 'hipLx', 'hipLz', 'knL', 'knLy', 'rise'];

export class Athlete {
  /**
   * @param {object} o { teamColor, capColor, trimColor, number, role, isGK, seed, preset, waterTint }
   */
  constructor(o) {
    const r = rng(o.seed * 104729 + 7);
    const morph = morphology(o.bodyRole || o.role, o.seed);
    this.morph = morph;
    const seg = o.preset.limbSeg, face = o.preset.faceDetail;
    const skin = C(SKIN[Math.floor(r() * SKIN.length)]);
    const hair = C(HAIR[Math.floor(r() * HAIR.length)]);
    const cap = C(o.capColor), team = C(o.teamColor), trim = C(o.trimColor ?? 0xffffff);
    // Kit (club editor / clubs database): suit pattern in a 2nd colour, cap binding, ear guards, number colour.
    const suit2 = C(o.suit2 ?? o.trimColor ?? 0xffffff), pattern = o.suitPattern || 'plain';
    const capTrim = C(o.capTrim ?? o.trimColor ?? 0xffffff), numColor = o.numberColor !== undefined ? '#' + C(o.numberColor).getHexString() : null;
    /** Suit pattern weight of the 2nd colour at a suit point (x right, y up, z front; metres, hip-relative). */
    const patternW = (x, y, z, hipY) => {
      if (pattern === 'halves') return x > 0 ? 1 : 0;
      if (pattern === 'stripe') return z > 0 && Math.abs(x) < 0.03 ? 1 : 0;
      if (pattern === 'sash') return z > 0 && Math.abs(x * 0.8 - (y - hipY - 0.03)) < 0.025 ? 1 : 0;
      if (pattern === 'chevron') return z > 0 ? gs(Math.abs(x) * 1.3 - (y - hipY - 0.02), 0.012) * 0.95 : 0;
      return 0;
    };
    const W = 0.19, S = 0.27, CAP = 0.55, SUIT = 0.36;   // roughness: wet skin, face, wet fabric cap, wet suit
    const rich = o.preset.limbSeg >= 10;
    const mat = athleteMaterial(o.waterTint || C(0x0b5d84), rich);
    const bulk = morph.bulk, sw = morph.shoulders, waist = morph.waist;
    // Appearance (all tied to the seed: a player always has the same face, hair and body).
    const hairStyle = HAIR_STYLES[Math.floor(r() * HAIR_STYLES.length)];
    const facial = r(), wetHair = hair.clone().multiplyScalar(0.72);
    const bodyHair = r() < 0.35 ? 0.6 + r() * 0.4 : 0;   // like the reference team photo: some players have chest hair
    this.look = { hairStyle, body: morph.type, beard: facial < 0.3 ? 'beard' : facial < 0.42 ? 'moustache' : facial < 0.52 ? 'goatee' : facial < 0.75 ? 'stubble' : 'clean' };

    // Skeleton: every joint is a THREE.Bone; all body parts are merged into ONE skinned mesh
    // (rigid skinning, 1 bone per vertex) -> one draw call per athlete.
    this.root = new THREE.Group();
    const bones = [];
    const bone = (parent) => { const b = new THREE.Bone(); bones.push(b); if (parent) parent.add(b); return b; };
    const rootBone = bone(null);
    this.pivot = bone(rootBone);           // body tilt (pitch / roll), chest at the water line
    this.torso = bone(this.pivot);         // pelvis (yaw / roll), legs hang from it
    this.chest = bone(this.torso);         // thorax over the lumbar spine: bend, side bend, twist; arms and head hang from it
    const partsByBone = new Map();
    const mesh = (parts, b) => { partsByBone.set(b, (partsByBone.get(b) || []).concat(parts)); };
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

    const scan = HEAD && (rich || o.preset.scanHead);
    // Face and body in the same skin tone: the body takes the average colour of the tinted face texture.
    const bodySkin = scan ? SCAN_REF.clone().multiply(scanTint(skin)).multiplyScalar(1.06) : skin;
    const mhb = scan && BODY, build = BUILD[morph.type] || 'athletic';
    this.realistic = !!mhb;
    // --- torso: smooth lathe profile (hips -> waist -> ribcage -> shoulders), sculpted muscles:
    // pectorals, abdominals, linea alba, lats (V shape), shoulder blades, spine groove.
    const front = (v) => sstep(0, 0.12, v.z), back = (v) => sstep(0, -0.12, v.z);
    const pecs = (y, ax) => sstep(-0.135, -0.105, y) * gs(y + 0.045, 0.07) * gs(ax - 0.07, 0.055);
    const abs = (y, ax) => sstep(-0.44, -0.4, y) * sstep(-0.12, -0.16, y) * (0.5 + 0.5 * Math.cos(((y + 0.165) / 0.085) * Math.PI * 2)) * gs(ax - 0.032, 0.028);
    const torsoGeo = sculptLathe([[0.0, -0.64], [0.135, -0.62], [0.15, -0.52], [0.138, -0.4], [0.145, -0.28], [0.168, -0.15], [0.182, -0.04], [0.172, 0.04], [0.12, 0.09], [0.06, 0.105], [0.0, 0.11]],
      seg * 2 + 12, seg * 3 + 12, (v) => {
        const ax = Math.abs(v.x), fr = front(v), bk = back(v), sx = Math.sign(v.x);
        v.z += fr * (0.045 * bulk * pecs(v.y, ax) + 0.014 * abs(v.y, ax) - 0.007 * gs(v.x, 0.012) * sstep(-0.45, -0.12, v.y))
          + bk * (0.009 * gs(v.x, 0.016) * sstep(-0.5, 0.0, v.y) - 0.014 * gs(v.y + 0.05, 0.06) * gs(ax - 0.075, 0.04));
        v.x += sx * 0.016 * bulk * gs(v.y + 0.13, 0.1) * gs(v.z + 0.02, 0.1);   // lats
        const wk = 1 + (waist - 1) * sstep(-0.2, -0.45, v.y); v.x *= wk; v.z *= wk;         // waist / hips of the body type
      }, (v) => {
        const ax = Math.abs(v.x), fr = front(v), bk = back(v);
        return 1 - fr * (0.13 * gs(v.y + 0.122, 0.012) * gs(ax - 0.075, 0.05) + 0.09 * (1 - abs(v.y, ax)) * sstep(-0.44, -0.4, v.y) * sstep(-0.11, -0.16, v.y) * gs(ax, 0.07)
          + 0.12 * gs(v.x, 0.01) * sstep(-0.45, -0.1, v.y)) - bk * 0.12 * gs(v.x, 0.014) * sstep(-0.5, 0.0, v.y);
      });
    // Suit: real garment shell over the hips (glutes, front, waistband), team colour with trim
    // waistband, leg bands, side panels, diagonal motif and darker seams (vertex colours).
    const briefs = sculptLathe([[0.0, -0.665], [0.142, -0.65], [0.152, -0.6], [0.157, -0.55], [0.15, -0.5], [0.147, -0.47], [0.0, -0.455]], 12, seg * 3 + 8,
      (v) => { v.z -= 0.014 * gs(v.y + 0.58, 0.05) * gs(Math.abs(v.x) - 0.06, 0.05) * back(v); v.z += 0.008 * gs(v.y + 0.6, 0.04) * gs(v.x, 0.05) * front(v); });
    const suitColors = paint(briefs, (v, c) => {
      const ax = Math.abs(v.x), side = gs(v.z, 0.035) * sstep(0.1, 0.13, ax);
      c.copy(team);
      c.lerp(suit2, patternW(v.x, v.y, v.z, -0.62));                                                  // kit pattern
      if (v.y > -0.485 || v.y < -0.64) c.copy(trim);                                                 // waistband, leg bands
      c.lerp(trim, side * 0.9);                                                                       // side panels
      c.multiplyScalar(1 - 0.35 * gs(v.x, 0.006) * sstep(-0.5, -0.58, v.y) - 0.25 * gs(Math.abs(v.y + 0.49) , 0.004));   // seams
    });
    const neck = sculptLathe([[0, 0.06], [0.074, 0.075], [0.064, 0.13], [0.057, 0.2], [0.05, 0.25], [0, 0.27]], 10, seg * 2 + 4,
      (v) => { v.x *= 1 + 0.12 * gs(v.y - 0.1, 0.04) * sstep(0.02, -0.04, v.z); });   // sternocleidomastoid / traps base
    if (!mhb) mesh([
      { geo: torsoGeo, color: skin, rough: W, scale: V3(1.22 * sw, 1, 0.74 * bulk) },
      { geo: briefs, colors: suitColors, color: team, rough: SUIT, scale: V3(1.24 * sw * waist, 1, 0.78 * bulk * waist) },
      { geo: new THREE.TorusGeometry(0.012, 0.004, 4, 8), color: trim, rough: SUIT, pos: V3(0.012, -0.49, 0.121 * bulk * waist), scale: V3(1, 0.6, 0.5) },   // drawstring bow
      { geo: new THREE.TorusGeometry(0.012, 0.004, 4, 8), color: trim, rough: SUIT, pos: V3(-0.012, -0.49, 0.121 * bulk * waist), scale: V3(1, 0.6, 0.5) },
      { geo: neck, color: skin, rough: W },
      { geo: new THREE.SphereGeometry(0.06, seg, seg), color: skin, rough: W, pos: V3(0.09 * sw, 0.06, -0.01), scale: V3(1.3, 0.6, 1) },    // trapezius
      { geo: new THREE.SphereGeometry(0.06, seg, seg), color: skin, rough: W, pos: V3(-0.09 * sw, 0.06, -0.01), scale: V3(1.3, 0.6, 1) },
    ], this.chest);
    this.chest.userData.blend = [-0.18, -0.42, 1];   // below the waist the procedural trunk follows the pelvis

    // --- head: one sculpted mesh (skull, jaw, chin, cheekbones, brow, sockets, nose, lips;
    // beard / stubble and shading in vertex colours), eyes with lids, cap, ear guards, chin strap
    this.head = bone(this.chest); this.head.position.set(0, 0.2, 0.005);
    if (mhb) this.head.position.fromArray(BODY.joints[build].headBone);
    const hs = 1 + (r() - 0.5) * 0.08, R = 0.112;
    const bk = this.look.beard;
    const FP = { jawW: 0.8 + r() * 0.16, faceW: 0.92 + r() * 0.1, nose: 0.12 + r() * 0.08, noseW: 0.08 + r() * 0.05, brow: 0.035 + r() * 0.035, chin: 0.03 + r() * 0.05,
      lips: 0.02 + r() * 0.025, seed: o.seed % 97, beard: bk === 'beard' ? 0.85 : bk === 'stubble' ? 0.14 : 0, moustache: bk === 'moustache' || bk === 'goatee' ? 0.85 : 0,
      goatee: bk === 'goatee' ? 0.85 : 0, eyeX: 0.034 + r() * 0.007, eyeS: 0.9 + r() * 0.2 };
    const sculpt = sculptHead(face ? seg * 4 + 8 : 14, face ? seg * 3 + 6 : 10, FP, skin, hair);
    sculpt.geo.applyMatrix4(new THREE.Matrix4().compose(V3(0, 0.1, 0), new THREE.Quaternion(), V3(0.92 * hs * R, 1.08 * R, 1.02 * R)));
    const scanGeo = scan ? scanHeadGeometry(FP, skin, hair) : null;
    const headParts = scan ? [] : [{ geo: sculpt.geo, colors: sculpt.colors, color: skin, rough: S }];
    if (scanGeo) {
      const iris = C(r() < 0.3 ? 0x3d6b8f : r() < 0.5 ? 0x5a7a3a : 0x3b2414);
      for (const [ex, ey, ez] of scanGeo.userData.eyes) {
        const wc = ez - 0.0125, R = 0.0118;   // eyeball centre behind the lids, iris and pupil on its front
        headParts.push({ geo: new THREE.SphereGeometry(R, 14, 10), color: C(0xcfc6b8), rough: 0.08, pos: V3(ex, ey, wc) });
        headParts.push({ geo: new THREE.SphereGeometry(0.0066, 12, 8), color: iris, rough: 0.05, pos: V3(ex, ey - 0.0003, wc + R * 0.92), scale: V3(1, 1, 0.45) });
        headParts.push({ geo: new THREE.SphereGeometry(0.003, 8, 6), color: C(0x030303), rough: 0.02, pos: V3(ex, ey - 0.0003, wc + R * 0.98), scale: V3(1, 1, 0.4) });
      }
    }
    if (face && !scan) {
      const eyeY = 0.118, eyeX = FP.eyeX * hs * FP.faceW, es = FP.eyeS;
      const lidGeo = new THREE.SphereGeometry(0.0158, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.45);
      for (const sx of [-1, 1]) {
        const ez = surfaceZ(sculpt.geo, sx * eyeX, eyeY) - 0.003;
        headParts.push({ geo: new THREE.SphereGeometry(0.0145, 10, 8), color: C(0xf4f1ea), rough: 0.15, pos: V3(sx * eyeX, eyeY, ez), scale: V3(1.15 * es, 0.8 * es, 0.7) });
        headParts.push({ geo: new THREE.SphereGeometry(0.0078, 8, 6), color: C(r() < 0.3 ? 0x3d6b8f : 0x2b1a10), rough: 0.08, pos: V3(sx * eyeX, eyeY - 0.001, ez + 0.0085), scale: V3(1, 1, 0.6) });
        headParts.push({ geo: lidGeo, color: skin.clone().multiplyScalar(0.92), rough: S, pos: V3(sx * eyeX, eyeY + 0.001, ez - 0.001), scale: V3(1.15, 0.75, 0.78), quat: Q(0.35, 0, 0) });   // upper lid
        const by = eyeY + 0.021;
        headParts.push({ geo: new THREE.CapsuleGeometry(0.0042, 0.03, 2, 6), color: hair, rough: 0.85, pos: V3(sx * (eyeX + 0.002), by, surfaceZ(sculpt.geo, sx * eyeX, by) + 0.001),
          quat: Q(0, sx * 0.35, Math.PI / 2 - sx * (0.1 + r() * 0.12)) });   // eyebrow
      }
      const my = 0.049;
      headParts.push({ geo: new THREE.CapsuleGeometry(0.0022, 0.026, 2, 6), color: C(0x5e2c28), rough: 0.5, pos: V3(0, my, surfaceZ(sculpt.geo, 0, my) - 0.0005), quat: Q(0, 0, Math.PI / 2) });  // mouth line
      const ny = 0.083;
      headParts.push({ geo: new THREE.SphereGeometry(0.0125, 8, 6), color: skin, rough: S, pos: V3(0, ny, surfaceZ(sculpt.geo, 0, ny) - 0.006), scale: V3(1.25 * FP.noseW / 0.1, 0.85, 1) });   // nose tip / nostrils
      for (const sx of [-1, 1]) headParts.push({ geo: new THREE.SphereGeometry(0.004, 6, 4), color: skin.clone().multiplyScalar(0.45), rough: 0.6, pos: V3(sx * 0.008, ny - 0.009, surfaceZ(sculpt.geo, sx * 0.008, ny - 0.009) + 0.001) });   // nostrils
      if (FP.moustache > 0) headParts.push({ geo: new THREE.CapsuleGeometry(0.005, 0.03, 2, 6), color: wetHair, rough: 0.5, pos: V3(0, 0.062, surfaceZ(sculpt.geo, 0, 0.062) + 0.002), quat: Q(0, 0, Math.PI / 2), scale: V3(1, 1, 0.7) });
      // Ears: helix + lobe, mostly hidden by the ear guards (the lobe and the rim show around them).
      for (const sx of [-1, 1]) {
        headParts.push({ geo: new THREE.TorusGeometry(0.026, 0.007, 5, 10, Math.PI * 1.3), color: skin.clone().lerp(C(0xc0504a), 0.15), rough: S, pos: V3(sx * 0.094 * hs * FP.faceW, 0.085, 0.0), quat: Q(0, sx * Math.PI / 2, -Math.PI * 0.62), scale: V3(1, 1.3, 1) });
        headParts.push({ geo: new THREE.SphereGeometry(0.0095, 6, 5), color: skin.clone().lerp(C(0xc0504a), 0.15), rough: S, pos: V3(sx * 0.097 * hs * FP.faceW, 0.039, 0.012), scale: V3(0.6, 1, 0.9) });
      }
    }
    // Cap: fitted fabric cap on the actual head shape (see buildCap).
    const capRes = face ? Math.max(16, seg * 2 + 4) : 12;
    const CAPB = buildCap(scanGeo || sculpt.geo, { res: capRes, thick: 0.0045, ell: scan ? [0.112, 0.128, 0.126] : [0.104, 0.122, 0.118], cap, trim: capTrim,
      guard: o.guardColor !== undefined ? C(o.guardColor) : cap.getHSL({}).l < 0.55 ? C(0xeef1f4) : cap.clone().multiplyScalar(0.82),   /* white ear guards on dark / red caps */ rough: CAP, strings: face });
    headParts.push(...CAPB.parts);
    // Hair (wet: darker, glossy). Shaved: nothing shows under the cap.
    const HR = 0.42;
    if (hairStyle === 'short' || hairStyle === 'wavy') {
      headParts.push({ geo: new THREE.SphereGeometry(0.05, seg, seg), color: wetHair, rough: HR, pos: V3(0, 0.045, -0.072), scale: V3(1.4, hairStyle === 'wavy' ? 0.75 : 0.5, 0.6) });
      if (hairStyle === 'wavy') for (let k = 0; k < 5; k++) headParts.push({ geo: new THREE.SphereGeometry(0.016, 6, 5), color: wetHair, rough: HR, pos: V3((k - 2) * 0.025, 0.02 + Math.abs(k - 2) * 0.008, -0.08 + Math.abs(k - 2) * 0.006), scale: V3(1, 1.6, 0.7) });
    } else if (hairStyle === 'curly') {
      for (let k = 0; k < 9; k++) { const a = (k / 8 - 0.5) * 2.2; headParts.push({ geo: new THREE.SphereGeometry(0.015, 6, 5), color: wetHair, rough: HR, pos: V3(Math.sin(a) * 0.085, 0.035 + (k % 2) * 0.012, -Math.cos(a) * 0.085) }); }
      if (face) for (const x of [-0.035, 0, 0.035]) headParts.push({ geo: new THREE.SphereGeometry(0.011, 6, 5), color: wetHair, rough: HR, pos: V3(x, 0.163, surfaceZ(sculpt.geo, x, 0.163) - 0.004) });
    }
    mesh(headParts, this.head);
    // Long hair: wet locks coming out under the cap, on their own bone with a spring (secondary motion).
    this.hair = null;
    if (hairStyle === 'long') {
      this.hair = bone(this.head); this.hair.position.set(0, 0.035, -0.085);
      const lock = sculptLathe([[0, -0.2], [0.02, -0.18], [0.035, -0.1], [0.045, -0.03], [0.04, 0.01], [0, 0.03]], 10, seg + 4, (v) => { v.x *= 1.6; v.z *= 0.45; v.z -= 0.03 * sstep(0, -0.2, v.y); });
      mesh([{ geo: lock, color: wetHair, rough: HR }], this.hair);
    }
    this.hairA = 0; this.hairV = 0; this.hairZ = 0;
    // Cap number on the back of the cap.
    if (face) {
      // Cap numbers (like real caps): on the back and on both sides above the ear guards, laid on the fabric.
      const numGeos = [];
      for (const [a, y, sz] of [[Math.PI, 0.13, 0.08], [Math.PI * 0.68, 0.15, 0.055], [-Math.PI * 0.68, 0.15, 0.055]]) {
        const { p, n } = CAPB.surface(a, y, 0.002), g = new THREE.PlaneGeometry(sz, sz);
        g.applyMatrix4(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), new THREE.Vector3(1, 1, 1)));
        numGeos.push(g);
      }
      const num = new THREE.Mesh(concatPlanes(numGeos), new THREE.MeshBasicMaterial({ map: numberTexture(o.number, numColor || (cap.getHSL({}).l > 0.6 ? '#173a8c' : '#ffffff')), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      this.head.add(num);
      if (rich) {   // HIGH / ULTRA: number on the suit (left hip), same texture
        const sn = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), num.material);
        if (mhb) { sn.position.set(-0.1, -0.415, 0.098); sn.rotation.set(-0.15, -0.5, 0); } else { sn.position.set(-0.115 * sw * waist, -0.55, 0.13 * bulk * waist); sn.rotation.set(0, -0.55, 0); }
        this.torso.add(sn);   // suit number: on the pelvis
      }
    }

    // --- arms: sculpted deltoid, biceps / triceps, forearm muscles tapering to the wrist
    const armSeg = seg + 6, armRows = seg + 6;
    const upperArm = sculptLathe([[0, -0.315], [0.036 * bulk, -0.302], [0.043 * bulk, -0.27], [0.047 * bulk, -0.22], [0.053 * bulk, -0.16], [0.057 * bulk, -0.1], [0.064 * bulk, -0.05], [0.064 * bulk, -0.01], [0.05 * bulk, 0.03], [0, 0.05]], armRows, armSeg,
      (v) => { v.z += 0.014 * bulk * gs(v.y + 0.15, 0.06) * front(v) - 0.01 * bulk * gs(v.y + 0.1, 0.07) * back(v); });
    const foreArm = sculptLathe([[0, -0.25], [0.029, -0.236], [0.031, -0.2], [0.04 * bulk, -0.12], [0.047 * bulk, -0.06], [0.045 * bulk, -0.02], [0.036, 0.02], [0, 0.035]], armRows, armSeg,
      (v) => { v.x *= 1 + 0.18 * sstep(-0.1, -0.22, v.y); v.z *= 1 - 0.2 * sstep(-0.1, -0.22, v.y); });   // flat wrist
    const arm = (side) => {
      const sh = bone(this.chest); sh.position.set(side * 0.205 * sw, 0.03, 0); sh.userData.blend = [-0.06, 0.04, 0.35];
      mesh([
        { geo: upperArm, color: skin, rough: W },
        { geo: new THREE.SphereGeometry(0.037 * bulk, seg, seg), color: skin, rough: W, pos: V3(0, -0.28, 0) },   // elbow
      ], sh);
      const el = bone(sh); el.position.set(0, -0.28, 0); el.userData.blend = [-0.03, 0.035, 0.5];
      const handParts = [
        { geo: foreArm, color: skin, rough: W },
        { geo: new THREE.SphereGeometry(0.045, seg, seg), color: skin, rough: W, pos: V3(0, -0.27, 0), scale: V3(0.95, 1.25, 0.5) },                    // palm
        { geo: new THREE.CapsuleGeometry(0.012, 0.035, 2, 5), color: skin, rough: W, pos: V3(side * -0.035, -0.255, 0.018), quat: Q(0.3, 0, side * 0.7) }, // thumb
      ];
      for (let f = 0; f < 4; f++) {
        handParts.push({ geo: new THREE.CapsuleGeometry(0.0095, 0.045 - Math.abs(f - 1.5) * 0.006, 2, 5), color: skin, rough: W,
          pos: V3((f - 1.5) * 0.019, -0.33, 0.004), quat: Q(0.15, 0, 0) });
      }
      mesh(handParts, el);
      // Grip point = ball centre, one ball radius in front of the palm: the ball rests ON the hand.
      const hand = new THREE.Object3D(); hand.position.set(0, -0.315, 0.128); el.add(hand);
      return { sh, el, hand };
    };
    // Realistic body: bones placed on the MakeHuman joints. The mesh is bound in its A-pose (bind
    // rotations), so a zero pose = arms and legs straight down, like the procedural body.
    const binds = [];
    const mhArm = (side) => {
      const Jt = BODY.joints[build], c = side > 0 ? 'l' : 'r', v = (k) => new THREE.Vector3(...Jt[`${c}-${k}`]);
      const shW = v('shoulder'), elW = v('elbow'), wrW = v('hand'), fW = v('finger-3-1');
      const sh = bone(this.chest); sh.position.copy(shW);
      const A = new THREE.Quaternion().setFromUnitVectors(DOWN, elW.clone().sub(shW).normalize());
      const Bq = new THREE.Quaternion().setFromUnitVectors(DOWN, wrW.clone().sub(elW).normalize());
      const Hq = new THREE.Quaternion().setFromUnitVectors(DOWN, fW.clone().sub(wrW).normalize());
      const el = bone(sh); el.position.set(0, -elW.distanceTo(shW), 0);
      const wr = bone(el); wr.position.set(0, -wrW.distanceTo(elW), 0);
      // half-way shoulder bone: follows half of the arm rotation (no collapsed armpit when the arm is raised)
      const sm = bone(this.chest); sm.position.copy(shW);
      binds.push([sh, A], [el, A.clone().invert().multiply(Bq)], [wr, Bq.clone().invert().multiply(Hq)], [sm, new THREE.Quaternion().slerp(A, 0.5)]);
      // ball grip: in front of the palm (palm faces the body's front once the arm is down and turned)
      const hand = new THREE.Object3D(); hand.position.set(-side * 0.012, -0.075, 0.115); wr.add(hand);
      wr.userData.twist = 0;
      return { sh, el, wr, hand, sm };
    };
    const mhLeg = (side) => {
      const Jt = BODY.joints[build], c = side > 0 ? 'l' : 'r', v = (k) => new THREE.Vector3(...Jt[`${c}-${k}`]);
      const hW = v('upper-leg'), kW = v('knee'), aW = v('ankle');
      const hip = bone(this.torso); hip.position.copy(hW);
      const Cq = new THREE.Quaternion().setFromUnitVectors(DOWN, kW.clone().sub(hW).normalize());
      const Dq = new THREE.Quaternion().setFromUnitVectors(DOWN, aW.clone().sub(kW).normalize());
      const kn = bone(hip); kn.position.set(0, -kW.distanceTo(hW), 0);
      binds.push([hip, Cq], [kn, Cq.clone().invert().multiply(Dq)]);
      return { hip, kn };
    };
    if (mhb) { this.armR = mhArm(1); this.armL = mhArm(-1); } else { this.armR = arm(1); this.armL = arm(-1); }

    // --- legs (under water, shaded by the water tint): quadriceps, knee, calf
    const legSeg = seg + 2, legRows = seg + 2;
    const thigh = sculptLathe([[0, -0.46], [0.04 * bulk, -0.45], [0.05 * bulk, -0.41], [0.058 * bulk, -0.32], [0.07 * bulk, -0.18], [0.078 * bulk, -0.06], [0.075 * bulk, 0], [0.06, 0.04], [0, 0.06]], legRows, legSeg,
      (v) => { v.z += 0.01 * bulk * gs(v.y + 0.12, 0.1) * front(v); });
    const shin = sculptLathe([[0, -0.38], [0.03, -0.36], [0.032, -0.3], [0.044 * bulk, -0.2], [0.052 * bulk, -0.1], [0.05 * bulk, -0.04], [0.044, 0.02], [0, 0.04]], legRows, legSeg,
      (v) => { v.z -= 0.012 * bulk * gs(v.y + 0.11, 0.06) * back(v); });
    const leg = (side) => {
      const hip = bone(this.torso); hip.position.set(side * 0.092 * sw, -0.6, 0); hip.userData.blend = [-0.04, 0.06, 0.5];
      mesh([{ geo: thigh, color: skin, rough: W }], hip);
      const kn = bone(hip); kn.position.set(0, -0.42, 0); kn.userData.blend = [-0.03, 0.04, 0.5];
      mesh([
        { geo: shin, color: skin, rough: W },
        { geo: new THREE.SphereGeometry(0.05, seg, seg), color: skin, rough: W, pos: V3(0, -0.395, 0.045), scale: V3(0.8, 0.5, 2.1) },   // foot
      ], kn);
      return { hip, kn };
    };
    if (mhb) { this.legR = mhLeg(1); this.legL = mhLeg(-1); } else { this.legR = leg(1); this.legL = leg(-1); }
    for (const [b, q] of binds) b.quaternion.copy(q);   // bind pose = the mesh's A-pose
    if (mhb) {
      // Grip from the real hand geometry: palm centre (wrist .. middle knuckle) + one ball radius along the
      // palm normal (thumb / little finger / curl of the fingers). Stored in the wrist frame, with the palm
      // normal and the hand axis, for the forearm rotation (pronation) below.
      rootBone.updateMatrixWorld(true);
      for (const [arm, c] of [[this.armR, 'l'], [this.armL, 'r']]) {
        const Jt = BODY.joints[build], v = (k) => new THREE.Vector3(...Jt[`${c}-${k}`]);
        const w = v('hand'), m = v('finger-3-1'), t = v('finger-1-2'), L = v('finger-5-1'), tip = v('finger-3-4');
        const n = m.clone().sub(w).cross(L.clone().sub(t)).normalize(); if (n.dot(tip.clone().sub(m)) < 0) n.negate();
        const g = w.clone().lerp(m, 0.6).addScaledVector(n, 0.115);
        const inv = arm.wr.matrixWorld.clone().invert(), qi = arm.wr.getWorldQuaternion(new THREE.Quaternion()).invert();
        arm.hand.position.copy(g.applyMatrix4(inv));
        arm.palmN = n.applyQuaternion(qi); arm.handAxis = m.clone().sub(w).normalize().applyQuaternion(qi);
      }
    }

    // ---- bake: parts -> mesh space at the bind pose, bound 100 % to their bone
    rootBone.updateMatrixWorld(true);
    const geos = [];
    for (const [b, parts] of partsByBone) {
      const g = mergeParts(parts);
      const n = g.attributes.position.count, bi = bones.indexOf(b);
      const si = new Uint16Array(n * 4), sw4 = new Float32Array(n * 4), bl = b.userData.blend, py = g.attributes.position.array;
      const pi = bl ? bones.indexOf(b.parent) : 0;
      for (let i = 0; i < n; i++) {
        // Joints: vertices near the joint are shared with the parent bone (smooth shoulder / elbow / hip /
        // knee instead of rigid mannequin pieces); everything else is rigid.
        const wp = bl ? sstep(bl[0], bl[1], py[i * 3 + 1]) * bl[2] : 0;
        si[i * 4] = bi; sw4[i * 4] = 1 - wp; si[i * 4 + 1] = pi; sw4[i * 4 + 1] = wp;
      }
      g.applyMatrix4(b.matrixWorld);
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw4, 4));
      geos.push(g);
    }
    const skinned = new THREE.SkinnedMesh(concatGeometries(geos), mat);
    skinned.castShadow = true; skinned.frustumCulled = false;
    skinned.add(rootBone);
    skinned.bind(new THREE.Skeleton(bones));
    this.root.add(skinned);
    if (scan) {
      const hg = scanGeo, hn = hg.attributes.position.count, hi = bones.indexOf(this.head);
      const si = new Uint16Array(hn * 4), sw4 = new Float32Array(hn * 4); for (let i = 0; i < hn; i++) { si[i * 4] = hi; sw4[i * 4] = 1; }
      hg.applyMatrix4(this.head.matrixWorld);
      hg.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); hg.setAttribute('skinWeight', new THREE.BufferAttribute(sw4, 4));
      const hm = new THREE.SkinnedMesh(hg, headMaterial(o.waterTint || C(0x0b5d84), rich));
      hm.castShadow = true; hm.frustumCulled = false; hm.bind(skinned.skeleton, skinned.bindMatrix);
      this.root.add(hm);
    }
    if (mhb) {
      const Bd = BODY, vi = Bd.variants.indexOf(build), nv = Bd.nv;
      const byName = { torso: this.torso, chest: this.chest, head: this.head, shL: this.armR.sh, elL: this.armR.el, wrL: this.armR.wr, shR: this.armL.sh, elR: this.armL.el, wrR: this.armL.wr,
        hipL: this.legR.hip, knL: this.legR.kn, hipR: this.legL.hip, knR: this.legL.kn, smL: this.armR.sm, smR: this.armL.sm };
      const id = Bd.bones.map((n) => bones.indexOf(byName[n]));
      const si = new Uint16Array(nv * 4), sw4 = new Float32Array(nv * 4), col = new Float32Array(nv * 3), rg = new Float32Array(nv), P = Bd.pos[vi].array;
      const cc = new THREE.Color(), ss = (a, b, x) => sstep(a, b, x);
      for (let k = 0; k < nv; k++) {
        for (let j = 0; j < 4; j++) { si[k * 4 + j] = id[Bd.b4[k * 4 + j]]; sw4[k * 4 + j] = Bd.w4[k * 4 + j]; }
        const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
        if (Bd.suit[k]) {
          // suit: team colour, trim waistband / leg bands (from the asset), side panels and a chevron
          cc.copy(team);
          if (Bd.suit[k] === 200) cc.copy(trim);
          else {
            cc.lerp(suit2, patternW(x, y, z, Bd.suitRef.hipY));
            cc.lerp(trim, 0.9 * gs(z, 0.02) * ss(0.11, 0.14, Math.abs(x)));
          }
          rg[k] = SUIT;
        } else {
          const h = Math.sin(k * 12.9898) * 43758.5453, hn = h - Math.floor(h); cc.copy(bodySkin).multiplyScalar(1 + (hn - 0.5) * 0.04);   // tone variation
          // Body hair (some players): chest between the pectorals, sternum, line down to the navel; patchy.
          if (bodyHair > 0 && z > 0.02) {
            const ax = Math.abs(x), chest = gs(y + 0.13, 0.09) * gs(ax - 0.04, 0.09), trail = gs(ax, 0.025) * ss(-0.12, -0.2, y) * ss(-0.4, -0.3, y);
            cc.lerp(wetHair, Math.min(1, (chest + trail) * bodyHair * (0.55 + 0.45 * hn)) * 0.55);
          }
          rg[k] = W;
        }
        cc.multiplyScalar(0.35 + 0.65 * Bd.ao[k] / 255);   // baked cavity occlusion (armpits, under the pecs, between muscles)
        col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b;
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', Bd.pos[vi]); bg.setAttribute('normal', Bd.nor[vi]); bg.setIndex(Bd.index);
      bg.setAttribute('color', new THREE.BufferAttribute(col, 3)); bg.setAttribute('aRough', new THREE.BufferAttribute(rg, 1));
      bg.setAttribute('aMus', new THREE.BufferAttribute(new Float32Array(nv).fill(1), 1));   // muscle definition (bind-pose field) applies to this mesh
      bg.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); bg.setAttribute('skinWeight', new THREE.BufferAttribute(sw4, 4));
      const bm = new THREE.SkinnedMesh(bg, mat); bm.castShadow = true; bm.frustumCulled = false; bm.bind(skinned.skeleton, skinned.bindMatrix);
      this.root.add(bm);
    }
    for (const [b] of binds) b.quaternion.identity();
    this.root.scale.setScalar(morph.height);

    // Animation state.
    this.pose = Object.fromEntries(JOINTS.map((k) => [k, 0]));
    this.w = { swim: 0, hold: 0, wind: 0, throw: 0, block: 0, gk: o.isGK ? 1 : 0, dive: 0, celebrate: 0, receive: 0, reach: 0, save: 0 };
    this.phase = r() * 6.28; this.tread = r() * 6.28; this.throwT = 0; this.throwKind = 'shot'; this.diveT = 0; this.diveDir = 1; this.celebrateT = 0; this.celebrateKind = 'arms';
    this.isGK = o.isGK; this.lastStroke = 0; this.onStroke = null; this.onDrip = null;
    this.reachT = 0; this.reachDir = 1; this.saveT = 0; this.lookT = 0; this.lookTarget = new THREE.Vector3();
    this.prevYaw = null; this.yawRate = 0; this.prevSpeed = 0; this.accel = 0; this.prevRise = 0; this.dripAcc = 0;
  }

  /** One-shot actions triggered by match events. */
  /** kind: 'pass' | 'shot' | 'power' | 'lob' */
  playThrow(kind) { this.throwT = THROW_DUR[kind] || 0.38; this.throwKind = kind; }
  /** Interception / steal: lunge with one arm toward the ball (dir +1 right, -1 left). */
  playReach(dir) { this.reachT = 0.45; this.reachDir = dir; }
  /** Goalkeeper parry: both hands up toward the shot. */
  playSave() { this.saveT = 0.5; }
  /** Look at a point for a while (pass target, goal...), then back to the default look target. */
  lookAtFor(x, y, z, dur) { this.lookTarget.set(x, y, z); this.lookT = dur; }
  playDive(dir) { this.diveT = 0.9; this.diveDir = dir; }
  playCelebrate(kind = 'arms') { this.celebrateT = 2.6; this.celebrateKind = kind; }

  /**
   * @param {number} dt
   * @param {object} s view state: x, z, fx, fz, vx, vz, sprint, hasBall, charging, charge, block, stamina,
   *                   ball (THREE.Vector3), receive (bool), time
   */
  update(dt, s) {
    const speed = Math.hypot(s.vx, s.vz);
    const fatigue = clamp(s.stamina ?? 1, 0, 1);
    this.throwT = Math.max(0, this.throwT - dt);
    this.diveT = Math.max(0, this.diveT - dt);
    this.celebrateT = Math.max(0, this.celebrateT - dt);
    this.windT = s.charging ? (this.windT || 0) + dt : 0;
    this.reachT = Math.max(0, this.reachT - dt); this.saveT = Math.max(0, this.saveT - dt); this.lookT = Math.max(0, this.lookT - dt);
    // Turning rate and acceleration (smoothed): banking into turns, leaning on acceleration / braking.
    const yaw0 = Math.atan2(s.fx, s.fz);
    if (this.prevYaw === null) this.prevYaw = yaw0;
    const ks = 1 - Math.exp(-dt * 6);
    this.yawRate += (wrap(yaw0 - this.prevYaw) / Math.max(dt, 1e-3) - this.yawRate) * ks; this.prevYaw = yaw0;
    this.accel += ((speed - this.prevSpeed) / Math.max(dt, 1e-3) - this.accel) * ks; this.prevSpeed = speed;
    const M = this.morph;

    // ---- blend weights (smoothed: no snapping between animations)
    const k = 1 - Math.exp(-dt * 9);
    // Local velocity: crawl only when swimming forward; sideways / backward moves are done with the
    // eggbeater (as real players do over short distances, facing the play).
    const fl = Math.hypot(s.fx, s.fz) || 1, fwdV = (s.vx * s.fx + s.vz * s.fz) / fl, latV = (s.vx * s.fz - s.vz * s.fx) / fl;
    // Dribbling: the ball is pushed between the arms with a head-up crawl (held overhead only when stopped).
    const dribble = s.hasBall && !s.charging && fwdV > 0.6;
    const target = {
      swim: (s.hasBall && !dribble) || s.charging || this.celebrateT > 0 ? 0 : clamp((fwdV - 0.35) / 0.7, 0, 1),
      hold: s.hasBall && !s.charging && !dribble ? 1 : 0,
      wind: s.charging ? 1 : 0,
      throw: this.throwT > 0 ? 1 : 0,
      block: s.block > 0 ? 1 : 0,
      gk: this.isGK && !s.hasBall ? 1 : 0,
      dive: this.diveT > 0 ? 1 : 0,
      celebrate: this.celebrateT > 0 ? 1 : 0,
      receive: s.receive && !s.hasBall ? 1 : 0,
      reach: this.reachT > 0 ? 1 : 0,
      save: this.saveT > 0 ? 1 : 0,
    };
    for (const key in target) this.w[key] = (this.w[key] || 0) + (target[key] - (this.w[key] || 0)) * (key === 'throw' || key === 'dive' || key === 'reach' || key === 'save' ? 1 - Math.exp(-dt * 25) : k);
    const w = this.w;
    this.dribbling = dribble && w.swim > 0.4;
    // kick splash (white water behind the feet), stronger when dribbling or sprinting
    if (this.onKick && w.swim > 0.5) {
      this.kickAcc = (this.kickAcc || 0) + dt * (this.dribbling ? 9 : s.sprint ? 6 : 2.5);
      if (this.kickAcc > 1) { this.kickAcc -= 1; const yw = Math.atan2(s.fx, s.fz); this.onKick(s.x - Math.sin(yw) * 1.25, s.z - Math.cos(yw) * 1.25, this.dribbling ? 0.55 : 0.35); }
    }

    // ---- cycles
    const strokeRate = (2.4 + speed * 2.2 + (s.sprint ? 1.2 : 0)) * (0.7 + 0.3 * fatigue) * M.tempo;
    const prev = this.phase;
    this.phase += dt * strokeRate * w.swim;
    this.tread += dt * (this.isGK ? 7.5 : 5.5) * (0.75 + 0.25 * fatigue) * M.tempo;
    // Stroke splash when a hand enters the water (two per cycle).
    if (w.swim > 0.5 && this.onStroke) {
      const twoPi = Math.PI * 2;
      // hand entry in front of the head: stroke angle π, reached at phase 0.8π (right) and 1.8π (left)
      for (const off of [0.8 * Math.PI, 1.8 * Math.PI]) {
        if (Math.floor((prev - off) / twoPi) !== Math.floor((this.phase - off) / twoPi)) {
          const h = off < 4 ? this.armR.hand : this.armL.hand;
          h.getWorldPosition(tmpV); this.onStroke(tmpV.x, tmpV.z, 0.4 + speed * 0.35);
        }
      }
    }

    // ---- base pose: eggbeater tread <-> front crawl
    const t = this.tread, p = this.phase;
    const P = {};
    // Eggbeater: trunk upright, hands sculling a figure of eight at the surface, alternate leg circles
    // turning the pelvis a little; travelling sideways / backward leans the body into the move.
    const travel = 1 - w.swim, back = clamp(-fwdV / 1.2, 0, 1), side = clamp(latV / 1.2, -1, 1);
    const scull = 0.18 + 0.22 * clamp(Math.hypot(fwdV, latV) / 1.2, 0, 1);
    const tread = CLIPS.treading ? this.mocapTread(back, side, travel, fatigue) : {
      chestX: 0.04 - back * 0.12, chestY: Math.sin(t) * 0.03, chestZ: side * 0.08, pelvisY: Math.sin(t) * 0.07, pelvisZ: 0,
      pitch: 0.1 - back * 0.22 * travel, roll: -side * 0.18 * travel, twist: 0, neck: 0, headX: -0.1 + back * 0.1, headY: 0,
      shRy: 0, shLy: 0, shRx: -0.5 + Math.sin(t) * 0.1, shRz: 0.5 + Math.sin(t * 2 + 1) * scull, elR: -1.05 + Math.sin(t * 2 + 0.5) * 0.3,
      shLx: -0.5 + Math.sin(t + 2) * 0.1, shLz: -0.5 - Math.sin(t * 2 + 3) * scull, elL: -1.05 + Math.sin(t * 2 + 2.5) * 0.3,
      hipRx: -1.05, hipRz: 0.55, knR: 1.55, knRy: Math.sin(t) * 0.7, hipLx: -1.05, hipLz: -0.55, knL: 1.55, knLy: Math.sin(t + Math.PI) * 0.7,
      rise: (Math.sin(t * 2) * 0.012) - (1 - fatigue) * 0.06,
    };
    // Head-up front crawl (water polo): head out of the water looking ahead, shoulders roll with each
    // stroke (thorax more than pelvis), arms wide and short at the entry, high-elbow recovery, bent-elbow
    // pull under the body, small fast flutter kick. The head stays level while the shoulders roll.
    // Stroke timing (crawl animation reference): the underwater pull lasts ~60 % of the cycle, the recovery
    // over the water ~40 % (the arms overlap in front: catch-up). qR / qL = arm angle (0..π recovery, π = entry,
    // π..2π catch, pull under the body, push to the hip). The trunk rolls up to ~40° toward the recovering
    // arm, the pelvis follows at 60 %; the head stays level, eyes forward (water polo).
    const qR = strokeAngle(p), qL = strokeAngle(p + Math.PI);
    const roll = (Math.sin(qR) - Math.sin(qL)) * 0.5 * 0.42 * ROLL_SIGN;
    const swim = {
      chestX: -0.18, chestY: roll, chestZ: 0, pelvisY: roll * 0.6, pelvisZ: 0,
      pitch: 1.0, roll: 0, twist: 0, neck: -0.6, headX: -0.6, headY: -roll * 0.95,
      // recovery elbow-led and close to the water, long reach at the entry, S-shaped pull under the body
      shRy: 0, shLy: 0, shRx: qR - 2 * Math.PI, shRz: 0.14 + 0.2 * Math.max(0, Math.sin(qR)) - 0.12 * Math.max(0, -Math.sin(qR - 0.35)), elR: crawlElbow(qR),
      shLx: qL - 2 * Math.PI, shLz: -0.14 - 0.2 * Math.max(0, Math.sin(qL)) + 0.12 * Math.max(0, -Math.sin(qL - 0.35)), elL: crawlElbow(qL),
      // six-beat flutter kick from the hips, the knee bends a little later (whip), small and fast
      hipRx: 0.05 + Math.sin(p * 3) * 0.24, hipRz: 0.05, knR: 0.12 + Math.max(0, Math.sin(p * 3 - 0.7)) * 0.42, knRy: 0,
      hipLx: 0.05 - Math.sin(p * 3) * 0.24, hipLz: -0.05, knL: 0.12 + Math.max(0, -Math.sin(p * 3 - 0.7)) * 0.42, knLy: 0,
      rise: 0.08,   // shoulders high: head-up crawl
    };
    for (const j of JOINTS) P[j] = tread[j] + (swim[j] - tread[j]) * w.swim;
    // Swim arms rotate continuously: take them from the swim pose when swimming.
    if (w.swim > 0.5) { P.shRx = swim.shRx; P.shLx = swim.shLx; }
    // Swimming with the ball (water polo coaching): 1) strong flutter kick at the surface, white water
    // behind; 2) high elbows, arms entering wide on each side of the ball to protect it; 3) head and chest
    // high, above the ball, eyes forward.
    if (this.dribbling) {
      const kq = this.phase * 1.6;
      P.pitch -= 0.25; P.chestX -= 0.12; P.rise += 0.07; P.neck += 0.15; P.headX += 0.12;
      P.shRz += 0.22; P.shLz -= 0.22;
      P.elR -= 0.35 * Math.max(0, Math.sin(wrapPos(p))); P.elL -= 0.35 * Math.max(0, Math.sin(wrapPos(p + Math.PI)));
      P.hipRx = 0.15 + Math.sin(kq * 3) * 0.32; P.hipLx = 0.15 - Math.sin(kq * 3) * 0.32;
      P.knR = 0.15 + Math.max(0, Math.sin(kq * 3)) * 0.45; P.knL = 0.15 + Math.max(0, -Math.sin(kq * 3)) * 0.45;
    }
    // Sprint: flatter, head lower, arms closer to the body. Body type sets the stroke amplitude.
    if (s.sprint) { P.pitch += 0.08 * w.swim; P.neck -= 0.08 * w.swim; P.shRz *= 0.8; P.shLz *= 0.8; }
    P.shRz *= M.amp; P.shLz *= M.amp; P.knRy *= M.amp; P.knLy *= M.amp;
    // Acceleration leans forward; braking sits the body up with the legs forward.
    const brake = clamp(-this.accel / 4, 0, 1), push = clamp(this.accel / 4, 0, 1);
    P.pitch += push * 0.12 * w.swim - brake * 0.45 * w.swim; P.hipRx -= brake * 0.5; P.hipLx -= brake * 0.5; P.rise += brake * 0.05;
    // Turning: bank into the turn, head leads it.
    const turn = clamp(this.yawRate, -3, 3);
    P.roll -= turn * 0.1 * (0.4 + 0.6 * w.swim); P.headY += turn * 0.1;
    // Fatigue: head drops, arms scull lower and slower.
    const tired = clamp((0.4 - fatigue) / 0.4, 0, 1);
    P.headX += tired * 0.25; P.shRz -= tired * 0.15; P.shLz += tired * 0.15; P.pitch += tired * 0.08 * (1 - w.swim);

    // ---- goalkeeper stance: high in the water, arms wide and sculling, faster eggbeater
    if (w.gk > 0) {
      const g = { shRx: -0.55, shRz: 1.2 + Math.sin(t * 1.3) * 0.12, elR: -0.6, shLx: -0.55, shLz: -1.2 - Math.sin(t * 1.3 + 1) * 0.12, elL: -0.6, rise: 0.14, pitch: 0.02 };
      mix(P, g, w.gk * (1 - w.swim));
    }
    // ---- holding the ball (match footage): the ball stays on the water under the palm, arm forward,
    // body slightly forward; it is only lifted to shoot or pass.
    if (w.hold > 0) mix(P, { shRx: -1.2, shRz: 0.32, elR: -0.15, chestX: 0.05, pitch: 0.08, rise: 0.16, headX: -0.08 }, w.hold);
    this.ballLow = w.hold > 0.5 && w.wind < 0.2 && this.throwT <= 0;
    // ---- shot wind-up: arm cocked back, torso twisted, rising out of the water
    if (w.wind > 0) {
      const c = clamp(s.charge || 0, 0, 1), lift = clamp(this.windT / 0.38, 0, 1), le = lift * lift * (3 - 2 * lift);
      // Footage: the ball is scooped off the water and swept up in a wide arc out to the side (arm almost
      // straight), then cocked high behind the head (elbow above the shoulder); the eggbeater lifts the
      // body out of the water to the waist; pelvis and thorax turn back, the free arm sculls out to the side.
      const arc = Math.sin(le * Math.PI);
      mix(P, { shRx: -1.0 + (-2.0 - 0.75 * c) * le, shRz: 0.3 + 0.75 * arc, elR: -0.1 - (1.0 + 0.45 * c) * le,
        pelvisY: -0.22 * c * le, chestY: -0.5 * c * le, chestZ: 0.14 * c, chestX: -0.16 * c, twist: 0, pitch: -0.12 * c,
        rise: 0.08 + (0.1 + 0.14 * c) * le, shLx: -0.9, shLz: -0.95, elL: -0.35 + Math.sin(this.tread * 2) * 0.15, headY: 0.35 * c }, w.wind);
    }
    // ---- release (shot / pass): fast forward whip and follow-through
    if (w.throw > 0) {
      const kind = this.throwKind, dur = THROW_DUR[kind] || 0.38, u = 1 - this.throwT / dur;
      const e = 1 - Math.pow(1 - clamp(u * 1.6, 0, 1), 3);
      // pass: short whip; shot: torso rotation + whip; power: bigger rotation, body out of the water; lob: high soft arc
      const K = { pass: [2.0, 0.9, 0.35, 0.32], shot: [2.5, 0.9, 0.35, 0.32], power: [2.8, 1.35, 0.5, 0.42], lob: [1.3, 0.5, 0.1, 0.36] }[kind] || [2.5, 0.9, 0.35, 0.32];
      // Kinetic chain: the pelvis turns first, then the thorax, then the arm whips through; the free arm
      // pulls down and the trunk bends forward into the follow-through.
      const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
      const sp = kind === 'pass' ? 1.6 : 1;   // passes: same chain, shorter follow-through
      const ep = ease(u * 4.5 * sp), ec = ease((u - 0.04) * 3.8 * sp), ea = ease((u - 0.1) * 3.2 * sp), ft = ease((u - 0.35) * 2.2);
      // Release high in front, then (footage) the arm carries on down across the body, the thorax keeps
      // turning and the player falls forward back into the water.
      const big = kind === 'shot' || kind === 'power';
      mix(P, { shRx: -3.6 + ea * K[0] + (big ? ft * 0.9 : 0), shRz: 0.25 - (big ? 0.75 * ft : 0), elR: -1.1 * (1 - ea) * (kind === 'lob' ? 0.4 : 1) - (big ? 0.35 * ft : 0), twist: 0,
        pelvisY: (-0.22 + 0.36 * ep) * K[1], chestY: (-0.5 + 0.85 * ec + (big ? 0.3 * ft : 0)) * K[1], chestX: -0.16 + 0.4 * ea * K[1] + (big ? 0.25 * ft : 0), chestZ: 0.14 * (1 - ec),
        pitch: K[2] * ea - 0.1 + (big ? 0.2 * ft : 0), rise: Math.min(0.32, K[3]) * (1 - ea * 0.5) * (1 - u) + 0.05 - (big ? 0.05 * ft : 0),
        shLx: -1.35 + 0.9 * ec, shLz: -0.5, elL: -0.2, headX: kind === 'lob' ? -0.25 : 0 }, w.throw);
    }
    // ---- block: both arms straight up
    if (w.block > 0) mix(P, { shRx: -3.0, shRz: 0.22, elR: -0.1, shLx: -3.0, shLz: -0.22, elL: -0.1, rise: 0.26, pitch: 0 }, w.block);
    // ---- interception / steal: lunge, one arm reaching for the ball
    if (w.reach > 0) {
      const d = this.reachDir, u = 1 - this.reachT / 0.45, ext = Math.sin(Math.min(1, u * 1.4) * Math.PI);
      const R = d > 0 ? { shRx: -1.5 - 0.3 * ext, shRz: 0.9 * ext, elR: -0.05 } : { shLx: -1.5 - 0.3 * ext, shLz: -0.9 * ext, elL: -0.05 };
      mix(P, { ...R, pitch: 0.45 * ext, roll: -d * 0.25 * ext, rise: 0.12 * ext, twist: d * 0.3 * ext }, w.reach);
    }
    // ---- goalkeeper parry: both hands up toward the shot
    if (w.save > 0) mix(P, { shRx: -2.9, shRz: 0.5, elR: -0.15, shLx: -2.9, shLz: -0.5, elL: -0.15, rise: 0.34, pitch: -0.05, headX: -0.2 }, w.save);
    // ---- goalkeeper dive toward the ball side
    if (w.dive > 0) {
      const d = this.diveDir, u = 1 - this.diveT / 0.9;
      const reach = { roll: -d * 0.85, rise: 0.38 * Math.sin(Math.min(1, u * 1.5) * Math.PI) + 0.1, pitch: 0 };
      if (d > 0) Object.assign(reach, { shRx: -2.5, shRz: 1.45, elR: -0.05, shLx: -2.8, shLz: -0.5, elL: -0.2 });
      else Object.assign(reach, { shLx: -2.5, shLz: -1.45, elL: -0.05, shRx: -2.8, shRz: 0.5, elR: -0.2 });
      mix(P, reach, w.dive);
    }
    // ---- celebration
    if (w.celebrate > 0) {
      const ct = this.celebrateT;
      const cel = this.celebrateKind === 'splash'
        ? { shRx: -1.4 + Math.sin(ct * 14) * 0.9, shRz: 0.5, elR: -0.3, shLx: -1.4 - Math.sin(ct * 14) * 0.9, shLz: -0.5, elL: -0.3, rise: 0.15, pitch: 0.3 }
        : { shRx: -3.0 + Math.sin(ct * 9) * 0.25, shRz: 0.45, elR: -0.2, shLx: -3.0 - Math.sin(ct * 9) * 0.25, shLz: -0.45, elL: -0.2,
            rise: 0.28 + Math.abs(Math.sin(ct * 5)) * 0.22, pitch: -0.1, headX: -0.3 };
      mix(P, cel, w.celebrate);
    }

    // ---- head tracking: the ball by default, the goal while winding up a shot, the pass target
    // while passing (lookAtFor). Head turns and tilts; the torso follows a little when not swimming.
    const L = this.lookT > 0 ? this.lookTarget : s.look || s.ball;
    tmpV.set(L.x - s.x, 0, L.z - s.z);
    const yaw = Math.atan2(s.fx, s.fz), hd = Math.hypot(tmpV.x, tmpV.z);
    const look = clamp(wrap(Math.atan2(tmpV.x, tmpV.z) - yaw), -1.2, 1.2);
    P.headY += look * (1 - w.wind * 0.5) * 0.85;
    P.twist += look * 0.25 * (1 - w.swim) * (1 - w.throw) * (1 - w.wind);
    P.headX -= clamp(Math.atan2((L.y ?? 0.2) - 0.55, Math.max(hd, 0.5)), -0.5, 0.6) * 0.7 * (1 - w.swim);

    // ---- smooth toward the target pose (shortest-angle), within human joint limits, and apply
    const sk = 1 - Math.exp(-dt * 14), circ = w.swim > 0.5;
    limitPose(P, circ);
    for (const j of JOINTS) {
      const fast = (j === 'shRx' || j === 'shLx') && circ;
      this.pose[j] += (j === 'rise' ? P[j] - this.pose[j] : wrap(P[j] - this.pose[j])) * (fast ? 1 : sk);
    }
    limitPose(this.pose, circ);
    const q = this.pose;
    this.root.position.set(s.x, q.rise + Math.sin(this.tread * 2 + 1) * 0.008, s.z);
    this.root.rotation.y = yaw;
    this.pivot.rotation.set(q.pitch, 0, q.roll);
    this.torso.rotation.set(0, q.twist * 0.35 + q.pelvisY, q.pelvisZ);
    this.chest.rotation.set(q.chestX, q.twist * 0.65 + q.chestY, q.chestZ);
    this.head.rotation.set(q.neck + q.headX, q.headY, 0);
    // shoulder: flexion (x), abduction (z), then the humeral rotation about the arm's own axis (y, applied first: order XZY)
    this.armR.sh.rotation.set(q.shRx, q.shRy, q.shRz, 'XZY'); this.armR.el.rotation.set(q.elR, 0, 0);
    this.armL.sh.rotation.set(q.shLx, q.shLy, q.shLz, 'XZY'); this.armL.el.rotation.set(q.elL, 0, 0);
    this.legR.hip.rotation.set(q.hipRx, 0, q.hipRz); this.legR.kn.rotation.set(q.knR, q.knRy, 0);
    this.legL.hip.rotation.set(q.hipLx, 0, q.hipLz); this.legL.kn.rotation.set(q.knL, q.knLy, 0);

    // ---- long hair: damped spring (hangs down against the head tilt, swings with speed and turns)
    if (this.hair) {
      const tgt = clamp(-(q.pitch + q.neck + q.headX) * 0.85 + speed * 0.12, -1.2, 1.4);
      this.hairV += ((tgt - this.hairA) * 60 - this.hairV * 9) * dt; this.hairA += this.hairV * dt;
      this.hairZ += (clamp(turn * 0.18 - q.roll * 0.6, -0.6, 0.6) - this.hairZ) * (1 - Math.exp(-dt * 5));
      this.hair.rotation.set(this.hairA, 0, this.hairZ);
    }
    // ---- water dripping off the body: rising out of the water, throws, dives, celebrations, fast swim
    if (this.onDrip) {
      const riseV = (q.rise - this.prevRise) / Math.max(dt, 1e-3); this.prevRise = q.rise;
      this.dripAcc += dt * (Math.max(0, riseV) * 30 + w.throw * 10 + w.dive * 14 + w.celebrate * 6 + w.save * 8 + (speed > 1.8 ? 2 : 0));
      if (this.dripAcc > 1) {
        this.dripAcc = Math.min(this.dripAcc - 1, 2);
        this.root.updateMatrixWorld(true);
        const src = [this.head, this.armR.hand, this.armL.hand, this.armR.el, this.armL.el, this.torso][Math.floor(Math.random() * 6)];
        src.getWorldPosition(tmpV2); if (tmpV2.y > 0.1) this.onDrip(tmpV2.x + (Math.random() - 0.5) * 0.1, tmpV2.y, tmpV2.z + (Math.random() - 0.5) * 0.1);
      }
    }

    // ---- catch IK: right arm reaches toward an incoming ball
    if (w.receive > 0.01) {
      this.root.updateMatrixWorld(true);
      const sh = this.armR.sh;
      sh.getWorldPosition(tmpV);
      tmpV2.copy(s.ball).sub(tmpV).normalize();                                     // world direction
      sh.parent.getWorldQuaternion(tmpQ).invert(); tmpV2.applyQuaternion(tmpQ);      // into the torso frame
      tmpQ.setFromUnitVectors(DOWN, tmpV2);
      sh.quaternion.slerp(tmpQ, clamp(w.receive, 0, 1));
      this.armR.el.rotation.x *= 1 - w.receive;
    }
    this.updateShoulders(w.receive > 0.01);
    // Forearm rotation: the palm faces down onto the ball held on the water, and faces the target when
    // winding up and throwing (realistic body; the procedural hand is already oriented).
    const pw = Math.max(w.hold, w.wind, w.throw);
    if (this.armR.palmN) {
      const arm = this.armR; arm.wr.quaternion.identity();
      if (pw > 0.01) {
        this.root.updateMatrixWorld(true);
        const wq = arm.wr.getWorldQuaternion(tmpQ), n0 = tmpV.copy(arm.palmN).applyQuaternion(wq), A = tmpV2.copy(arm.handAxis).applyQuaternion(wq);
        const yw = Math.atan2(s.fx, s.fz), D = w.hold > Math.max(w.wind, w.throw) ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(Math.sin(yw), 0.25, Math.cos(yw));
        D.addScaledVector(A, -D.dot(A)); n0.addScaledVector(A, -n0.dot(A));
        if (D.lengthSq() > 1e-4 && n0.lengthSq() > 1e-4) {
          D.normalize(); n0.normalize();
          const ang = clamp(Math.atan2(A.dot(n0.clone().cross(D)), n0.dot(D)), -1.6, 1.6);   // forearm pronation / supination range
          arm.wr.quaternion.setFromAxisAngle(arm.handAxis, ang * pw);
        }
      }
    }
    // Held ball: the hand goes down to the water (small arm IK on the shoulder flexion).
    if (this.ballLow) {
      for (let it = 0; it < 3; it++) {
        this.root.updateMatrixWorld(true); this.armR.hand.getWorldPosition(tmpV);
        const err = tmpV.y - 0.11; if (Math.abs(err) < 0.01) break;
        this.armR.sh.rotation.x = clamp(this.armR.sh.rotation.x + err * 1.6, -2.3, 0.2);
      }
    }
  }

  /**
   * Cinematic poses (pool entry), applied after update(): 'stand' upright on the deck, arms down;
   * 'dive' head-first racing dive, u = 0 (take-off) .. 1 (entry): body pitches down, arms over the head.
   */
  /** Treading water from the motion-captured clip (Mixamo "Treading Water", retargeted): alternate leg
   *  cycles, hands sculling in front, body leaning forward. Played faster than the clip (match tempo), the
   *  goalkeeper faster still; travelling backward / sideways leans the body into the move as before. */
  mocapTread(back, side, travel, fatigue) {
    const P = { chestX: 0, chestY: 0, chestZ: 0, pelvisY: 0, pelvisZ: 0, pitch: 0, roll: 0, twist: 0, neck: 0, headX: 0, headY: 0,
      shRx: 0, shRz: 0, shRy: 0, elR: 0, shLx: 0, shLz: 0, shLy: 0, elL: 0, hipRx: 0, hipRz: 0, knR: 0, knRy: 0, hipLx: 0, hipLz: 0, knL: 0, knLy: 0, rise: 0 };
    sampleClip(CLIPS.treading, (this.tread / (2 * Math.PI)) * 0.67, P);
    P.chestX -= back * 0.12; P.chestZ += side * 0.08; P.pitch -= back * 0.3 * travel; P.roll -= side * 0.18 * travel;
    P.rise -= (1 - fatigue) * 0.06;
    return P;
  }
  overridePose(kind, u = 0) {
    const L = [this.legR, this.legL], A = [this.armR, this.armL];
    this.torso.rotation.set(0, 0, 0); this.chest.rotation.set(0, 0, 0);
    if (kind === 'stand') {
      this.pivot.rotation.set(0, 0, 0); this.head.rotation.set(-0.05, 0, 0);
      A.forEach((a, i) => { a.sh.rotation.set(0.08, 0, (i ? -1 : 1) * 0.1); a.el.rotation.set(-0.2, 0, 0); });
      L.forEach((l, i) => { l.hip.rotation.set(0, 0, (i ? -1 : 1) * 0.03); l.kn.rotation.set(0, 0, 0); });
    } else {
      const crouch = Math.max(0, 1 - u * 4);   // short crouch at take-off
      this.pivot.rotation.set(0.35 + u * 1.55, 0, 0); this.head.rotation.set(-0.35, 0, 0);
      A.forEach((a, i) => { a.sh.rotation.set(-1.2 - 1.9 * Math.min(1, u * 3), 0, (i ? -1 : 1) * 0.08); a.el.rotation.set(0, 0, 0); });
      L.forEach((l) => { l.hip.rotation.set(-0.9 * crouch, 0, 0); l.kn.rotation.set(1.3 * crouch, 0, 0); });
    }
    for (const a of A) if (a.sm) a.sm.rotation.set(a.sh.rotation.x * 0.5, 0, a.sh.rotation.z * 0.5);
  }
  /** Height of the chest pivot above the feet when standing (m). */
  standHeight() { return 1.42 * this.morph.height; }

  /** Shoulder half-way bones (realistic body) follow half of the arm rotation. */
  updateShoulders(ik) {
    if (!this.armR.sm) return;
    // Half of the arm angles; the crawl turns the arm a full circle, so the half angle eases back to 0
    // around the top (continuous, no flip of the shoulder region).
    const half = (a) => { const t = wrap(a), k = Math.abs(t) < 2.85 ? 1 : sstep(Math.PI, 2.85, Math.abs(t)); return 0.5 * t * k; };
    const q = this.pose;
    this.armR.sm.rotation.set(half(q.shRx), 0, q.shRz * 0.5);
    this.armL.sm.rotation.set(half(q.shLx), 0, q.shLz * 0.5);
    if (ik) this.armR.sm.quaternion.copy(IDQ).slerp(this.armR.sh.quaternion, 0.5);
  }

  /** World position of the right hand's grip point (where a held ball sits). */
  handWorld(out) { this.root.updateMatrixWorld(true); return this.armR.hand.getWorldPosition(out); }
  /** Where the ball is when this athlete has it: in the right hand (grip point = ball centre against the
   *  palm), or floating in front of the head when dribbling. */
  ballWorld(out, time = 0) {
    if (this.dribbling) { const r = this.root, yw = r.rotation.y; return out.set(r.position.x + Math.sin(yw) * 0.5, 0.11 + Math.sin(time * 9) * 0.01, r.position.z + Math.cos(yw) * 0.5); }
    this.handWorld(out); if (this.ballLow) out.y = Math.max(out.y, 0.1);   // resting on the water under the palm
    return out;
  }
}

/** Concatenates geometries that share the same attribute layout. */
function concatGeometries(list) {
  const out = new THREE.BufferGeometry();
  const names = Object.keys(list[0].attributes);
  let vc = 0, ic = 0;
  for (const g of list) { vc += g.attributes.position.count; ic += g.index.count; }
  for (const name of names) {
    const a0 = list[0].attributes[name], arr = new a0.array.constructor(vc * a0.itemSize);
    let o = 0; for (const g of list) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, a0.itemSize));
  }
  const idx = new Uint32Array(ic); let io = 0, vo = 0;
  for (const g of list) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; vo += g.attributes.position.count; }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/** Arm angle of the crawl from the stroke phase: recovery (0..π) in 40 % of the cycle, pull (π..2π) in 60 %. */
function strokeAngle(p) {
  const u = wrapPos(p), R = 0.8 * Math.PI;
  return u < R ? u / 0.8 : Math.PI + (u - R) / 1.2;
}
/**
 * Elbow in the crawl (stroke angle q): straight at the entry and the reach, high-elbow catch with the forearm
 * vertical (~100°) early in the pull, extending through the push to the hip, bent ~90° during the recovery.
 */
function crawlElbow(q) {
  q = wrapPos(q);
  if (q >= Math.PI) { const u = (q - Math.PI) / Math.PI; return -1.75 * Math.sin(Math.min(1, u * 1.6) * Math.PI) * (u < 0.62 ? 1 : 0.7) - 0.1; }   // catch -> pull -> push
  return -1.55 * Math.sin(q) - 0.1;   // recovery: elbow high, hand close to the water (continuous with the push)
}
const ROLL_SIGN = 1;
/**
 * Human range of motion (radians, this rig's conventions: elbow / hip flexion negative, knee flexion
 * positive, abduction outward = +z for the right side). The swim stroke is a shoulder circumduction, so
 * the shoulder flexion angle is only limited out of the crawl.
 */
export const JOINT_LIMITS = {
  elR: [-2.55, 0], elL: [-2.55, 0],                         // elbow: ~145° flexion, no hyperextension
  knR: [0, 2.4], knL: [0, 2.4],                             // knee: ~140° flexion, no hyperextension
  knRy: [-0.7, 0.7], knLy: [-0.7, 0.7],                     // tibial rotation (knee bent, eggbeater)
  hipRx: [-2.2, 0.45], hipLx: [-2.2, 0.45],                 // hip: 125° flexion, 25° extension
  hipRz: [-0.35, 0.9], hipLz: [-0.9, 0.35],                 // hip abduction 50°, adduction 20°
  shRz: [-0.45, 3.1], shLz: [-3.1, 0.45],                   // shoulder abduction 180°, adduction 25°
  shRy: [-1.4, 1.4], shLy: [-1.4, 1.4],                     // humeral rotation (internal / external) ~80°
  chestX: [-0.45, 0.75], chestY: [-0.65, 0.65], chestZ: [-0.45, 0.45],   // thoracolumbar flex / ext, rotation, side bend
  pelvisY: [-0.5, 0.5], pelvisZ: [-0.3, 0.3],
  headY: [-1.3, 1.3],                                       // neck rotation 75°
};
const SH_FLEX = [-3.75, 1.05];                              // shoulder: 215° (arm overhead and behind, throwing) .. 60° extension
function limitPose(P, circumduction) {
  for (const k in JOINT_LIMITS) { const [a, b] = JOINT_LIMITS[k]; if (P[k] < a) P[k] = a; else if (P[k] > b) P[k] = b; }
  const nk = P.neck + P.headX;                              // cervical flexion / extension, total ~ 50° / 70°
  if (nk < -1.25) P.headX -= nk + 1.25; else if (nk > 0.9) P.headX -= nk - 0.9;
  if (!circumduction) for (const k of ['shRx', 'shLx']) {
    // allowed: [-3.75, 1.05]; once wrapped to (-π, π] the forbidden band is (1.05, 2.53): snap to the nearest end
    const v = wrap(P[k]), hi = SH_FLEX[1], lo = SH_FLEX[0] + 2 * Math.PI;
    if (v > hi && v < lo) P[k] = v - hi < lo - v ? hi : SH_FLEX[0];
  }
}
function wrapPos(a) { const t = a % (Math.PI * 2); return t < 0 ? t + Math.PI * 2 : t; }
function mix(P, o, w) { for (const k in o) P[k] += (o[k] - P[k]) * w; }
