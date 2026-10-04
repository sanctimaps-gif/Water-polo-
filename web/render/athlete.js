// Procedural water polo athlete: articulated skeleton (pelvis, torso, neck, head, shoulders,
// upper arms, forearms, hands, thighs, shins, feet), parametric face and morphology, real cap
// with ear guards, chin strap and number, wet skin; animated by a blended procedural pose system
// (tread / eggbeater, front crawl, ball hold, shot wind-up & release, pass, block, catch IK,
// goalkeeper ready & dive, celebration, fatigue).
//
// Performance: every rigid part of a bone is merged into ONE mesh with per-vertex colour and
// roughness, and all athletes share ONE material -> ~11 draw calls per player.
import * as THREE from '../vendor/three.module.min.js';

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
let SHARED = null;
function athleteMaterial(waterTint) {
  if (SHARED) return SHARED;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 1.1 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uUwTint = { value: waterTint };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRough;\nvarying float vRough;\nvarying float vUwY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRough = aRough;\nvUwY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRough;\nvarying float vUwY;\nuniform vec3 uUwTint;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRough;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (vUwY < 0.0) { float k = clamp(0.3 - vUwY * 0.5, 0.0, 0.85); gl_FragColor.rgb = mix(gl_FragColor.rgb, uUwTint, k); }');
  };
  m.customProgramCacheKey = () => 'athlete';
  SHARED = m;
  return m;
}

// ---------------------------------------------------------------- appearance
const SKIN = [0xf1c7a6, 0xe0ac87, 0xc68b62, 0xa86d47, 0x7c4e31, 0x5a3622];
const HAIR = [0x1d140f, 0x3a2818, 0x5b3b1f, 0x8a6236, 0xc9a26b, 0x2a2a2a];
const C = (hex) => new THREE.Color(hex);

function rng(seed) {
  let s = seed >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0; s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0; s = (s ^ (s >>> 16)) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Morphology from role + seed: height, shoulder width, bulk. */
export function morphology(role, seed) {
  const r = rng(seed * 7919 + 13);
  const base = { GOALKEEPER: [1.06, 1.05, 1.0], CENTER: [1.04, 1.12, 1.14], DEFENDER: [1.02, 1.08, 1.08], WINGER: [0.96, 0.97, 0.94],
    PLAYMAKER: [0.99, 1.0, 0.98], FINISHER: [1.01, 1.04, 1.04], ALL_ROUNDER: [1, 1, 1] }[role] || [1, 1, 1];
  return { height: base[0] + (r() - 0.5) * 0.06, shoulders: base[1] + (r() - 0.5) * 0.06, bulk: base[2] + (r() - 0.5) * 0.08 };
}

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
  const lip = skin.clone().lerp(C(0x9c4a46), 0.45), socket = skin.clone().multiplyScalar(0.8), dark = skin.clone().multiplyScalar(0.72), c = new THREE.Color();
  for (let i = 0; i < a.length; i += 3) {
    let x = a[i], y = a[i + 1], z = a[i + 2];
    const f = sstep(-0.2, 0.75, z);                                   // 0 back of the skull .. 1 face
    if (y < 0) y *= 1 + 0.3 * f;                                      // longer lower face
    x *= 1 - (1 - P.jawW) * sstep(0.05, -0.9, y) * (0.4 + 0.6 * f);   // jaw width
    if (z < 0) z *= 0.95;
    const top = 1 - 0.05 * sstep(0.4, 0.9, y); x *= top; y *= top; z *= top;   // stays under the cap
    const ax = Math.abs(x), sx = Math.sign(x);
    const nose = P.nose * gs(x, 0.1) * (y > -0.12 ? sstep(0.32, -0.12, y) : gs(y + 0.12, 0.06));
    const eye = gs(y - 0.15, 0.1) * gs(ax - 0.36, 0.13);
    const lips = gs(y + 0.42, 0.06) * gs(x, 0.2);
    z += f * (P.brow * gs(y - 0.33, 0.09) * gs(x, 0.5) - 0.07 * eye + 0.035 * gs(y + 0.05, 0.14) * gs(ax - 0.5, 0.14)
      + nose + 0.03 * lips - 0.018 * gs(y + 0.56, 0.05) * gs(x, 0.16) + P.chin * gs(y + 0.86, 0.12) * gs(x, 0.26));
    x += sx * (0.04 * gs(y + 0.05, 0.15) * gs(z - 0.5, 0.25) - 0.035 * gs(y + 0.42, 0.15) * gs(z - 0.45, 0.25));
    a[i] = x; a[i + 1] = y; a[i + 2] = z;
    // colour: sockets & under-chin shading (cheap ambient occlusion), lips, beard / stubble
    c.copy(skin).lerp(socket, f * gs(y - 0.12, 0.1) * gs(ax - 0.3, 0.16) * 0.9).lerp(dark, sstep(-0.75, -1.1, y) * 0.6);
    c.lerp(lip, f * gs(y + 0.42, 0.045) * gs(x, 0.15) * 0.95);
    const beardZone = f * sstep(-0.22, -0.5, y) * (1 - gs(y + 0.42, 0.05) * gs(x, 0.17)) * sstep(0.95, 0.6, ax + 0.4 * (1 - f));
    c.lerp(hair, beardZone * P.beard);
    cols[i] = c.r; cols[i + 1] = c.g; cols[i + 2] = c.b;
  }
  return { geo: weldNormals(g), colors: cols };
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

function numberTexture(n, fg = '#ffffff') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '800 46px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(String(n), 32, 35);
  g.fillStyle = fg; g.fillText(String(n), 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- athlete
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const JOINTS = ['pitch', 'roll', 'twist', 'neck', 'headX', 'headY', 'shRx', 'shRz', 'elR', 'shLx', 'shLz', 'elL', 'hipRx', 'hipRz', 'knR', 'knRy', 'hipLx', 'hipLz', 'knL', 'knLy', 'rise'];

export class Athlete {
  /**
   * @param {object} o { teamColor, capColor, trimColor, number, role, isGK, seed, preset, waterTint }
   */
  constructor(o) {
    const r = rng(o.seed * 104729 + 7);
    const morph = morphology(o.role, o.seed);
    this.morph = morph;
    const seg = o.preset.limbSeg, face = o.preset.faceDetail;
    const skin = C(SKIN[Math.floor(r() * SKIN.length)]);
    const hair = C(HAIR[Math.floor(r() * HAIR.length)]);
    const cap = C(o.capColor), team = C(o.teamColor), trim = C(o.trimColor ?? 0xffffff);
    const W = 0.32, S = 0.36, CAP = 0.7, SUIT = 0.55;   // roughness: wet skin, face, fabric cap, suit
    const mat = athleteMaterial(o.waterTint || C(0x0b5d84));
    const bulk = morph.bulk, sw = morph.shoulders;

    // Skeleton: every joint is a THREE.Bone; all body parts are merged into ONE skinned mesh
    // (rigid skinning, 1 bone per vertex) -> one draw call per athlete.
    this.root = new THREE.Group();
    const bones = [];
    const bone = (parent) => { const b = new THREE.Bone(); bones.push(b); if (parent) parent.add(b); return b; };
    const rootBone = bone(null);
    this.pivot = bone(rootBone);           // body tilt (pitch / roll), chest at the water line
    this.torso = bone(this.pivot);         // twist
    const partsByBone = new Map();
    const mesh = (parts, b) => { partsByBone.set(b, (partsByBone.get(b) || []).concat(parts)); };
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const Q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

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
      }, (v) => {
        const ax = Math.abs(v.x), fr = front(v), bk = back(v);
        return 1 - fr * (0.13 * gs(v.y + 0.122, 0.012) * gs(ax - 0.075, 0.05) + 0.09 * (1 - abs(v.y, ax)) * sstep(-0.44, -0.4, v.y) * sstep(-0.11, -0.16, v.y) * gs(ax, 0.07)
          + 0.12 * gs(v.x, 0.01) * sstep(-0.45, -0.1, v.y)) - bk * 0.12 * gs(v.x, 0.014) * sstep(-0.5, 0.0, v.y);
      });
    const briefs = new THREE.LatheGeometry([[0.0, -0.66], [0.142, -0.645], [0.157, -0.55], [0.15, -0.47], [0.0, -0.46]].map(([x, y]) => new THREE.Vector2(x, y)), seg * 2 + 4, Math.PI);
    const neck = sculptLathe([[0, 0.06], [0.074, 0.075], [0.064, 0.13], [0.058, 0.19], [0, 0.205]], 8, seg * 2 + 4,
      (v) => { v.x *= 1 + 0.12 * gs(v.y - 0.1, 0.04) * sstep(0.02, -0.04, v.z); });   // sternocleidomastoid / traps base
    mesh([
      { geo: torsoGeo, color: skin, rough: W, scale: V3(1.22 * sw, 1, 0.74 * bulk) },
      { geo: briefs, color: team, rough: SUIT, scale: V3(1.24 * sw, 1, 0.78 * bulk) },
      { geo: new THREE.BoxGeometry(0.24, 0.02, 0.01), color: trim, rough: SUIT, pos: V3(0, -0.5, 0.118 * bulk), scale: V3(sw, 1, 1) },
      { geo: neck, color: skin, rough: W },
      { geo: new THREE.SphereGeometry(0.06, seg, seg), color: skin, rough: W, pos: V3(0.09 * sw, 0.06, -0.01), scale: V3(1.3, 0.6, 1) },    // trapezius
      { geo: new THREE.SphereGeometry(0.06, seg, seg), color: skin, rough: W, pos: V3(-0.09 * sw, 0.06, -0.01), scale: V3(1.3, 0.6, 1) },
    ], this.torso);

    // --- head: one sculpted mesh (skull, jaw, chin, cheekbones, brow, sockets, nose, lips;
    // beard / stubble and shading in vertex colours), eyes with lids, cap, ear guards, chin strap
    this.head = bone(this.torso); this.head.position.set(0, 0.2, 0.005);
    const hs = 1 + (r() - 0.5) * 0.08, R = 0.112;
    const beard = r() < 0.45 ? 0.85 : 0.1 + r() * 0.15;
    const sculpt = sculptHead(face ? seg * 4 + 8 : 14, face ? seg * 3 + 6 : 10,
      { jawW: 0.82 + r() * 0.14, nose: 0.13 + r() * 0.07, brow: 0.04 + r() * 0.03, chin: 0.04 + r() * 0.04, beard }, skin, hair);
    sculpt.geo.applyMatrix4(new THREE.Matrix4().compose(V3(0, 0.1, 0), new THREE.Quaternion(), V3(0.92 * hs * R, 1.08 * R, 1.02 * R)));
    const headParts = [{ geo: sculpt.geo, colors: sculpt.colors, color: skin, rough: S }];
    if (face) {
      const eyeY = 0.118, eyeX = 0.037 * hs;
      const lidGeo = new THREE.SphereGeometry(0.0158, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.45);
      for (const sx of [-1, 1]) {
        const ez = surfaceZ(sculpt.geo, sx * eyeX, eyeY) - 0.003;
        headParts.push({ geo: new THREE.SphereGeometry(0.0145, 10, 8), color: C(0xf4f1ea), rough: 0.15, pos: V3(sx * eyeX, eyeY, ez), scale: V3(1.15, 0.8, 0.7) });
        headParts.push({ geo: new THREE.SphereGeometry(0.0078, 8, 6), color: C(r() < 0.3 ? 0x3d6b8f : 0x2b1a10), rough: 0.08, pos: V3(sx * eyeX, eyeY - 0.001, ez + 0.0085), scale: V3(1, 1, 0.6) });
        headParts.push({ geo: lidGeo, color: skin.clone().multiplyScalar(0.92), rough: S, pos: V3(sx * eyeX, eyeY + 0.001, ez - 0.001), scale: V3(1.15, 0.75, 0.78), quat: Q(0.35, 0, 0) });   // upper lid
        const by = eyeY + 0.021;
        headParts.push({ geo: new THREE.CapsuleGeometry(0.0042, 0.03, 2, 6), color: hair, rough: 0.85, pos: V3(sx * (eyeX + 0.002), by, surfaceZ(sculpt.geo, sx * eyeX, by) + 0.001),
          quat: Q(0, sx * 0.35, Math.PI / 2 - sx * (0.1 + r() * 0.12)) });   // eyebrow
      }
      const my = 0.049;
      headParts.push({ geo: new THREE.CapsuleGeometry(0.0022, 0.026, 2, 6), color: C(0x5e2c28), rough: 0.5, pos: V3(0, my, surfaceZ(sculpt.geo, 0, my) - 0.0005), quat: Q(0, 0, Math.PI / 2) });  // mouth line
      const ny = 0.083;
      headParts.push({ geo: new THREE.SphereGeometry(0.0125, 8, 6), color: skin, rough: S, pos: V3(0, ny, surfaceZ(sculpt.geo, 0, ny) - 0.006), scale: V3(1.25, 0.85, 1) });   // nose tip / nostrils
    }
    // Cap: fabric shell covering the skull and the back of the head, slightly tilted back.
    headParts.push({ geo: new THREE.SphereGeometry(0.117, seg * 2, seg + 2, 0, Math.PI * 2, 0, Math.PI * 0.52), color: cap, rough: CAP, pos: V3(0, 0.1, -0.006), quat: Q(-0.62, 0, 0), scale: V3(0.95 * hs, 1.06, 1.05) });
    headParts.push({ geo: new THREE.TorusGeometry(0.114, 0.0055, 4, seg * 2, Math.PI * 2), color: trim, rough: CAP, pos: V3(0, 0.1 + 0.068 * 0.0, -0.006), quat: Q(Math.PI / 2 - 0.62, 0, 0), scale: V3(0.95 * hs, 1.06, 1.05) }); // edge seam
    headParts.push({ geo: new THREE.TorusGeometry(0.117, 0.004, 3, seg * 2, Math.PI), color: trim, rough: CAP, pos: V3(0, 0.1, -0.006), quat: Q(0, Math.PI / 2, 0), scale: V3(1, 1.06, 1.05) });                       // centre seam
    for (const sx of [-1, 1]) {
      // Ear guard: rigid disc, with a ring of holes, part of the cap.
      headParts.push({ geo: new THREE.CylinderGeometry(0.046, 0.046, 0.022, seg * 2), color: cap, rough: 0.5, pos: V3(sx * 0.098 * hs, 0.085, 0.004), quat: Q(0, 0, Math.PI / 2) });
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        headParts.push({ geo: new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 5), color: C(0x111111), rough: 0.9,
          pos: V3(sx * (0.098 * hs + 0.012), 0.085 + Math.sin(a) * 0.022, 0.004 + Math.cos(a) * 0.022), quat: Q(0, 0, Math.PI / 2) });
      }
    }
    headParts.push({ geo: new THREE.TorusGeometry(0.09, 0.005, 4, seg * 2, Math.PI), color: cap, rough: CAP, pos: V3(0, 0.065, 0.012), quat: Q(0, Math.PI / 2, Math.PI) }); // chin strap
    headParts.push({ geo: new THREE.SphereGeometry(0.05, seg, seg), color: hair, rough: 0.9, pos: V3(0, 0.045, -0.072), scale: V3(1.4, 0.5, 0.6) }); // nape hair
    mesh(headParts, this.head);
    // Cap number on the back of the cap.
    if (face) {
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.085), new THREE.MeshBasicMaterial({ map: numberTexture(o.number), transparent: true, depthWrite: false }));
      num.position.set(0, 0.125, -0.113); num.rotation.set(0.35, Math.PI, 0); this.head.add(num);
    }

    // --- arms: sculpted deltoid, biceps / triceps, forearm muscles tapering to the wrist
    const armSeg = seg + 6, armRows = seg + 6;
    const upperArm = sculptLathe([[0, -0.315], [0.036 * bulk, -0.302], [0.043 * bulk, -0.27], [0.047 * bulk, -0.22], [0.053 * bulk, -0.16], [0.057 * bulk, -0.1], [0.064 * bulk, -0.05], [0.064 * bulk, -0.01], [0.05 * bulk, 0.03], [0, 0.05]], armRows, armSeg,
      (v) => { v.z += 0.014 * bulk * gs(v.y + 0.15, 0.06) * front(v) - 0.01 * bulk * gs(v.y + 0.1, 0.07) * back(v); });
    const foreArm = sculptLathe([[0, -0.25], [0.029, -0.236], [0.031, -0.2], [0.04 * bulk, -0.12], [0.047 * bulk, -0.06], [0.045 * bulk, -0.02], [0.036, 0.02], [0, 0.035]], armRows, armSeg,
      (v) => { v.x *= 1 + 0.18 * sstep(-0.1, -0.22, v.y); v.z *= 1 - 0.2 * sstep(-0.1, -0.22, v.y); });   // flat wrist
    const arm = (side) => {
      const sh = bone(this.torso); sh.position.set(side * 0.205 * sw, 0.03, 0);
      mesh([
        { geo: upperArm, color: skin, rough: W },
        { geo: new THREE.SphereGeometry(0.037 * bulk, seg, seg), color: skin, rough: W, pos: V3(0, -0.28, 0) },   // elbow
      ], sh);
      const el = bone(sh); el.position.set(0, -0.28, 0);
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
      const hand = new THREE.Object3D(); hand.position.set(0, -0.31, 0.06); el.add(hand);
      return { sh, el, hand };
    };
    this.armR = arm(1); this.armL = arm(-1);

    // --- legs (under water, shaded by the water tint): quadriceps, knee, calf
    const legSeg = seg + 2, legRows = seg + 2;
    const thigh = sculptLathe([[0, -0.46], [0.04 * bulk, -0.45], [0.05 * bulk, -0.41], [0.058 * bulk, -0.32], [0.07 * bulk, -0.18], [0.078 * bulk, -0.06], [0.075 * bulk, 0], [0.06, 0.04], [0, 0.06]], legRows, legSeg,
      (v) => { v.z += 0.01 * bulk * gs(v.y + 0.12, 0.1) * front(v); });
    const shin = sculptLathe([[0, -0.38], [0.03, -0.36], [0.032, -0.3], [0.044 * bulk, -0.2], [0.052 * bulk, -0.1], [0.05 * bulk, -0.04], [0.044, 0.02], [0, 0.04]], legRows, legSeg,
      (v) => { v.z -= 0.012 * bulk * gs(v.y + 0.11, 0.06) * back(v); });
    const leg = (side) => {
      const hip = bone(this.torso); hip.position.set(side * 0.092 * sw, -0.6, 0);
      mesh([{ geo: thigh, color: skin, rough: W }], hip);
      const kn = bone(hip); kn.position.set(0, -0.42, 0);
      mesh([
        { geo: shin, color: skin, rough: W },
        { geo: new THREE.SphereGeometry(0.05, seg, seg), color: skin, rough: W, pos: V3(0, -0.395, 0.045), scale: V3(0.8, 0.5, 2.1) },   // foot
      ], kn);
      return { hip, kn };
    };
    this.legR = leg(1); this.legL = leg(-1);

    // ---- bake: parts -> mesh space at the bind pose, bound 100 % to their bone
    rootBone.updateMatrixWorld(true);
    const geos = [];
    for (const [b, parts] of partsByBone) {
      const g = mergeParts(parts).applyMatrix4(b.matrixWorld);
      const n = g.attributes.position.count, bi = bones.indexOf(b);
      const si = new Uint16Array(n * 4), sw4 = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw4[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw4, 4));
      geos.push(g);
    }
    const skinned = new THREE.SkinnedMesh(concatGeometries(geos), mat);
    skinned.castShadow = true; skinned.frustumCulled = false;
    skinned.add(rootBone);
    skinned.bind(new THREE.Skeleton(bones));
    this.root.add(skinned);
    this.root.scale.setScalar(morph.height);

    // Animation state.
    this.pose = Object.fromEntries(JOINTS.map((k) => [k, 0]));
    this.w = { swim: 0, hold: 0, wind: 0, throw: 0, block: 0, gk: o.isGK ? 1 : 0, dive: 0, celebrate: 0, receive: 0 };
    this.phase = r() * 6.28; this.tread = r() * 6.28; this.throwT = 0; this.throwKind = 'shot'; this.diveT = 0; this.diveDir = 1; this.celebrateT = 0; this.celebrateKind = 'arms';
    this.isGK = o.isGK; this.lastStroke = 0; this.onStroke = null;
  }

  /** One-shot actions triggered by match events. */
  playThrow(kind) { this.throwT = kind === 'pass' ? 0.3 : 0.38; this.throwKind = kind; }
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

    // ---- blend weights (smoothed: no snapping between animations)
    const k = 1 - Math.exp(-dt * 9);
    const target = {
      swim: s.hasBall || s.charging || this.celebrateT > 0 ? 0 : clamp((speed - 0.35) / 0.7, 0, 1),
      hold: s.hasBall && !s.charging ? 1 : 0,
      wind: s.charging ? 1 : 0,
      throw: this.throwT > 0 ? 1 : 0,
      block: s.block > 0 ? 1 : 0,
      gk: this.isGK && !s.hasBall ? 1 : 0,
      dive: this.diveT > 0 ? 1 : 0,
      celebrate: this.celebrateT > 0 ? 1 : 0,
      receive: s.receive && !s.hasBall ? 1 : 0,
    };
    for (const key in target) this.w[key] += (target[key] - this.w[key]) * (key === 'throw' || key === 'dive' ? 1 - Math.exp(-dt * 25) : k);
    const w = this.w;

    // ---- cycles
    const strokeRate = (2.4 + speed * 2.2 + (s.sprint ? 1.2 : 0)) * (0.7 + 0.3 * fatigue);
    const prev = this.phase;
    this.phase += dt * strokeRate * w.swim;
    this.tread += dt * (this.isGK ? 7.5 : 5.5) * (0.75 + 0.25 * fatigue);
    // Stroke splash when a hand enters the water (two per cycle).
    if (w.swim > 0.5 && this.onStroke) {
      const twoPi = Math.PI * 2;
      for (const off of [1.2, 1.2 + Math.PI]) {
        if (Math.floor((prev - off) / twoPi) !== Math.floor((this.phase - off) / twoPi)) {
          const h = off < 2 ? this.armR.hand : this.armL.hand;
          h.getWorldPosition(tmpV); this.onStroke(tmpV.x, tmpV.z, 0.4 + speed * 0.35);
        }
      }
    }

    // ---- base pose: eggbeater tread <-> front crawl
    const t = this.tread, p = this.phase;
    const P = {};
    const tread = {
      pitch: 0.1, roll: 0, twist: 0, neck: 0, headX: -0.1, headY: 0,
      shRx: -0.45 + Math.sin(t) * 0.12, shRz: 0.55 + Math.sin(t + 1) * 0.18, elR: -1.0 + Math.sin(t + 0.5) * 0.3,
      shLx: -0.45 + Math.sin(t + 2) * 0.12, shLz: -0.55 - Math.sin(t + 3) * 0.18, elL: -1.0 + Math.sin(t + 2.5) * 0.3,
      hipRx: -1.05, hipRz: 0.55, knR: 1.55, knRy: Math.sin(t) * 0.7, hipLx: -1.05, hipLz: -0.55, knL: 1.55, knLy: Math.sin(t + Math.PI) * 0.7,
      rise: (Math.sin(t * 2) * 0.012) - (1 - fatigue) * 0.06,
    };
    const swim = {
      pitch: 1.12, roll: Math.sin(p) * 0.18, twist: 0, neck: -0.55, headX: -0.55, headY: Math.sin(p) * 0.1,
      shRx: -wrapPos(p), shRz: 0.22, elR: -0.9 * Math.max(0, Math.sin(p - 0.6)),
      shLx: -wrapPos(p + Math.PI), shLz: -0.22, elL: -0.9 * Math.max(0, Math.sin(p + Math.PI - 0.6)),
      hipRx: 0.05 + Math.sin(p * 2) * 0.32, hipRz: 0.06, knR: 0.25 + Math.max(0, Math.sin(p * 2)) * 0.4, knRy: 0,
      hipLx: 0.05 - Math.sin(p * 2) * 0.32, hipLz: -0.06, knL: 0.25 + Math.max(0, -Math.sin(p * 2)) * 0.4, knLy: 0,
      rise: 0.04,
    };
    for (const j of JOINTS) P[j] = tread[j] + (swim[j] - tread[j]) * w.swim;
    // Swim arms rotate continuously: take them from the swim pose when swimming.
    if (w.swim > 0.5) { P.shRx = swim.shRx; P.shLx = swim.shLx; }

    // ---- goalkeeper stance: high in the water, arms wide and sculling, faster eggbeater
    if (w.gk > 0) {
      const g = { shRx: -0.55, shRz: 1.2 + Math.sin(t * 1.3) * 0.12, elR: -0.6, shLx: -0.55, shLz: -1.2 - Math.sin(t * 1.3 + 1) * 0.12, elL: -0.6, rise: 0.14, pitch: 0.02 };
      mix(P, g, w.gk * (1 - w.swim));
    }
    // ---- holding the ball overhead (right hand), body up
    if (w.hold > 0) mix(P, { shRx: -2.85, shRz: 0.22, elR: -0.55, pitch: 0.05, rise: 0.1, headX: -0.05 }, w.hold);
    // ---- shot wind-up: arm cocked back, torso twisted, rising out of the water
    if (w.wind > 0) {
      const c = clamp(s.charge || 0, 0, 1);
      mix(P, { shRx: -2.95 - 0.75 * c, shRz: 0.32, elR: -0.95 - 0.45 * c, twist: -0.55 * c, pitch: -0.12 * c, rise: 0.12 + 0.26 * c,
        shLx: -1.15, shLz: -0.45, elL: -0.25, headY: 0.35 * c }, w.wind);
    }
    // ---- release (shot / pass): fast forward whip and follow-through
    if (w.throw > 0) {
      const dur = this.throwKind === 'pass' ? 0.3 : 0.38, u = 1 - this.throwT / dur;
      const e = 1 - Math.pow(1 - clamp(u * 1.6, 0, 1), 3);
      mix(P, { shRx: -3.6 + e * (this.throwKind === 'pass' ? 2.0 : 2.5), shRz: 0.25, elR: -1.1 * (1 - e), twist: -0.5 + e * 0.9, pitch: 0.35 * e - 0.1,
        rise: 0.32 * (1 - u) + 0.05, shLx: -0.8, shLz: -0.6 }, w.throw);
    }
    // ---- block: both arms straight up
    if (w.block > 0) mix(P, { shRx: -3.0, shRz: 0.22, elR: -0.1, shLx: -3.0, shLz: -0.22, elL: -0.1, rise: 0.26, pitch: 0 }, w.block);
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

    // ---- head looks at the ball
    tmpV.set(s.ball.x - s.x, 0, s.ball.z - s.z);
    const yaw = Math.atan2(s.fx, s.fz);
    const look = clamp(wrap(Math.atan2(tmpV.x, tmpV.z) - yaw), -1.1, 1.1);
    P.headY += look * (1 - w.wind) * 0.8;

    // ---- smooth toward the target pose (shortest-angle) and apply
    const sk = 1 - Math.exp(-dt * 14);
    for (const j of JOINTS) {
      const fast = (j === 'shRx' || j === 'shLx') && w.swim > 0.5;
      this.pose[j] += (j === 'rise' ? P[j] - this.pose[j] : wrap(P[j] - this.pose[j])) * (fast ? 1 : sk);
    }
    const q = this.pose;
    this.root.position.set(s.x, q.rise + Math.sin(this.tread * 2 + 1) * 0.008, s.z);
    this.root.rotation.y = yaw;
    this.pivot.rotation.set(q.pitch, 0, q.roll);
    this.torso.rotation.set(0, q.twist, 0);
    this.head.rotation.set(q.neck + q.headX, q.headY, 0);
    this.armR.sh.rotation.set(q.shRx, 0, q.shRz); this.armR.el.rotation.set(q.elR, 0, 0);
    this.armL.sh.rotation.set(q.shLx, 0, q.shLz); this.armL.el.rotation.set(q.elL, 0, 0);
    this.legR.hip.rotation.set(q.hipRx, 0, q.hipRz); this.legR.kn.rotation.set(q.knR, q.knRy, 0);
    this.legL.hip.rotation.set(q.hipLx, 0, q.hipLz); this.legL.kn.rotation.set(q.knL, q.knLy, 0);

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
  }

  /** World position of the right hand's grip point (where a held ball sits). */
  handWorld(out) { this.root.updateMatrixWorld(true); return this.armR.hand.getWorldPosition(out); }
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

function wrapPos(a) { const t = a % (Math.PI * 2); return t < 0 ? t + Math.PI * 2 : t; }
function mix(P, o, w) { for (const k in o) P[k] += (o[k] - P[k]) * w; }
