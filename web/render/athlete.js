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
    return { g: gg, color: p.color, rough: p.rough ?? 0.4 };
  });
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), col = new Float32Array(vCount * 3), rgh = new Float32Array(vCount);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const { g, color, rough } of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3);
    for (let i = 0; i < n; i++) { col[(vo + i) * 3] = color.r; col[(vo + i) * 3 + 1] = color.g; col[(vo + i) * 3 + 2] = color.b; rgh[vo + i] = rough; }
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
    const W = 0.4, S = 0.38, CAP = 0.7, SUIT = 0.55;   // roughness: wet skin, skin, fabric cap, suit
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

    // --- torso: lathe profile (hips -> waist -> ribcage -> shoulders), flattened front/back
    const prof = [[0.0, -0.64], [0.135, -0.62], [0.15, -0.52], [0.138, -0.4], [0.145, -0.28], [0.168, -0.15], [0.182, -0.04], [0.172, 0.04], [0.12, 0.09], [0.06, 0.105], [0.0, 0.11]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const torsoGeo = new THREE.LatheGeometry(prof, seg * 2 + 4);
    const briefs = new THREE.LatheGeometry([[0.0, -0.66], [0.142, -0.645], [0.157, -0.55], [0.15, -0.47], [0.0, -0.46]].map(([x, y]) => new THREE.Vector2(x, y)), seg * 2 + 4);
    const pec = new THREE.SphereGeometry(0.075, seg, seg);
    mesh([
      { geo: torsoGeo, color: skin, rough: W, scale: V3(1.22 * sw, 1, 0.74 * bulk) },
      { geo: briefs, color: team, rough: SUIT, scale: V3(1.24 * sw, 1, 0.78 * bulk) },
      { geo: new THREE.BoxGeometry(0.24, 0.02, 0.01), color: trim, rough: SUIT, pos: V3(0, -0.5, 0.118 * bulk), scale: V3(sw, 1, 1) },
      { geo: pec, color: skin, rough: W, pos: V3(0.07 * sw, -0.07, 0.085 * bulk), scale: V3(1.2, 0.75, 0.55 * bulk) },
      { geo: pec, color: skin, rough: W, pos: V3(-0.07 * sw, -0.07, 0.085 * bulk), scale: V3(1.2, 0.75, 0.55 * bulk) },
      { geo: new THREE.CylinderGeometry(0.052, 0.062, 0.12, seg), color: skin, rough: W, pos: V3(0, 0.14, 0) },
      { geo: new THREE.SphereGeometry(0.06, seg, seg), color: skin, rough: W, pos: V3(0.09 * sw, 0.06, -0.01), scale: V3(1.3, 0.6, 1) },    // trapezius
      { geo: new THREE.SphereGeometry(0.06, seg, seg), color: skin, rough: W, pos: V3(-0.09 * sw, 0.06, -0.01), scale: V3(1.3, 0.6, 1) },
    ], this.torso);

    // --- head: skull, jaw, face, cap shell, ear guards with holes, chin strap, beard
    this.head = bone(this.torso); this.head.position.set(0, 0.2, 0.005);
    const hs = 1 + (r() - 0.5) * 0.08, jaw = 0.9 + r() * 0.25, noseL = 0.035 + r() * 0.02;
    const headParts = [
      { geo: new THREE.SphereGeometry(0.112, seg * 2, seg + 4), color: skin, rough: S, pos: V3(0, 0.1, 0), scale: V3(0.92 * hs, 1.08, 1.02) },
      { geo: new THREE.SphereGeometry(0.08, seg * 2, seg), color: skin, rough: S, pos: V3(0, 0.04, 0.022), scale: V3(0.95 * jaw, 0.72, 1.05) },
    ];
    if (face) {
      const eyeY = 0.118, eyeX = 0.037, eyeZ = 0.094;
      for (const sx of [-1, 1]) {
        headParts.push({ geo: new THREE.SphereGeometry(0.0145, 8, 6), color: C(0xf4f1ea), rough: 0.2, pos: V3(sx * eyeX, eyeY, eyeZ), scale: V3(1.15, 0.8, 0.7) });
        headParts.push({ geo: new THREE.SphereGeometry(0.0085, 8, 6), color: C(r() < 0.3 ? 0x3d6b8f : 0x2b1a10), rough: 0.1, pos: V3(sx * eyeX, eyeY, eyeZ + 0.009) });
        headParts.push({ geo: new THREE.BoxGeometry(0.036, 0.008, 0.012), color: hair, rough: 0.8, pos: V3(sx * eyeX, eyeY + 0.024, eyeZ + 0.006), quat: Q(0, 0, -sx * (0.12 + r() * 0.12)) });
      }
      headParts.push({ geo: new THREE.ConeGeometry(0.018, noseL, 6), color: skin, rough: S, pos: V3(0, 0.087, 0.098 + noseL * 0.3), quat: Q(Math.PI / 2 + 0.25, 0, 0) });
      headParts.push({ geo: new THREE.BoxGeometry(0.038, 0.007, 0.01), color: C(0x8a4a40), rough: 0.5, pos: V3(0, 0.048, 0.098) });
      if (r() < 0.45) headParts.push({ geo: new THREE.SphereGeometry(0.083, seg * 2, seg), color: hair, rough: 0.9, pos: V3(0, 0.035, 0.024), scale: V3(0.98 * jaw, 0.66, 1.06) }); // beard
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

    // --- arms
    const arm = (side) => {
      const sh = bone(this.torso); sh.position.set(side * 0.205 * sw, 0.03, 0);
      mesh([
        { geo: new THREE.SphereGeometry(0.058 * bulk, seg, seg), color: skin, rough: W, pos: V3(side * -0.005, -0.035, 0), scale: V3(1, 1.25, 1) },   // deltoid
        { geo: new THREE.CapsuleGeometry(0.052 * bulk, 0.2, 3, seg), color: skin, rough: W, pos: V3(0, -0.14, 0), scale: V3(1, 1, 0.95) },
        { geo: new THREE.SphereGeometry(0.042 * bulk, seg, seg), color: skin, rough: W, pos: V3(0, -0.13, 0.03), scale: V3(0.9, 1.6, 0.8) },          // biceps
        { geo: new THREE.SphereGeometry(0.046 * bulk, seg, seg), color: skin, rough: W, pos: V3(0, -0.28, 0) },                                         // elbow
      ], sh);
      const el = bone(sh); el.position.set(0, -0.28, 0);
      const handParts = [
        { geo: new THREE.CapsuleGeometry(0.041 * bulk, 0.18, 3, seg), color: skin, rough: W, pos: V3(0, -0.12, 0) },
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

    // --- legs (under water: simpler, shaded by the water tint)
    const leg = (side) => {
      const hip = bone(this.torso); hip.position.set(side * 0.092 * sw, -0.6, 0);
      mesh([{ geo: new THREE.CapsuleGeometry(0.068 * bulk, 0.26, 3, seg), color: skin, rough: W, pos: V3(0, -0.2, 0) },
        { geo: new THREE.SphereGeometry(0.056 * bulk, seg, seg), color: skin, rough: W, pos: V3(0, -0.42, 0) }], hip);   // knee
      const kn = bone(hip); kn.position.set(0, -0.42, 0);
      mesh([
        { geo: new THREE.CapsuleGeometry(0.048 * bulk, 0.27, 3, seg), color: skin, rough: W, pos: V3(0, -0.19, 0) },
        { geo: new THREE.BoxGeometry(0.075, 0.05, 0.2), color: skin, rough: W, pos: V3(0, -0.4, 0.05) },
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
