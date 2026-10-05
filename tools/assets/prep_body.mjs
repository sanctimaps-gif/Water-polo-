import fs from 'fs';
import { parseObj, applyTarget, joints } from './mh.mjs';
const o = parseObj('./tools/assets/src/base.obj');
const T = (n) => `./tools/assets/src/${n}.target`;
// male = equal mix of the three MakeHuman ethnic male targets, then muscle / weight macro targets
const MALE = [['african-male-young', 1 / 3], ['asian-male-young', 1 / 3], ['caucasian-male-young', 1 / 3]];
const VARIANTS = {
  lean: [...MALE, ['universal-male-young-maxmuscle-minweight', 0.6], ['universal-male-young-maxmuscle-averageweight', 0.7]],
  athletic: [...MALE, ['universal-male-young-maxmuscle-averageweight', 1.4]],
  power: [...MALE, ['universal-male-young-maxmuscle-averageweight', 1.5], ['universal-male-young-maxmuscle-maxweight', 0.2]],
  massive: [...MALE, ['universal-male-young-maxmuscle-maxweight', 0.55], ['universal-male-young-maxmuscle-averageweight', 0.6]],
};

// faces of the body (quads -> triangles), head removed above the jaw line (the scanned head replaces it)
const meshes = {};
// Firm male chest: the lower edge of the pectorals may not hang below a line sloping back from the
// upper chest (removes the rounded look of the neutral base mesh).
function firmChest(V) {
  const ref = new Map(); const key = (x) => Math.round(x / 0.15);
  for (const v of V) if (v[1] > 4.35 && v[1] < 4.75 && v[2] > 0.3 && Math.abs(v[0]) < 1.7) { const k = key(v[0]); ref.set(k, Math.max(ref.get(k) ?? -9, v[2])); }
  for (const v of V) {
    if (v[2] < 0.3 || Math.abs(v[0]) > 1.6 || v[1] > 4.5 || v[1] < 3.0) continue;
    const r = ref.get(key(v[0])); if (r === undefined) continue;
    const lim = r - 0.22 * (4.5 - v[1]) - 0.05 * Math.max(0, 3.9 - v[1]) * 4;
    if (v[2] > lim) v[2] = lim + (v[2] - lim) * 0.25;
  }
}
// Water polo build (reference: national team photo): broad shoulders and upper chest, full pectorals,
// V-taper to a narrower waist, long arms; natural muscle, not a bodybuilder.
const ssT = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function waterPoloBuild(V, k) {
  const Jv = joints(o, V), sy = Jv['l-shoulder'][1], sx = Math.abs(Jv['l-shoulder'][0]), hy = Jv['l-upper-leg'][1];
  const SH = 0.13 * k;   // shoulder broadening (fraction of the shoulder half-width)
  for (const v of V) {
    const ax = Math.abs(v[0]), sg = Math.sign(v[0]) || 1;
    const upper = ssT(sy - 2.8, sy - 0.7, v[1]) * (1 - ssT(sy + 0.4, sy + 1.0, v[1]));   // chest .. shoulders, not the neck
    const armK = ssT(sx - 0.1, sx + 0.5, ax) * ssT(hy + 0.3, hy + 1.2, v[1]);              // arms (A-pose, out to the side)
    const torsoShift = ax < sx ? (ax / sx) * SH * sx * upper : SH * sx * upper;
    v[0] += sg * ((1 - armK) * torsoShift + armK * SH * sx);
    // narrower waist (V-taper), sides only
    const waist = Math.exp(-(((v[1] - (sy - 3.4)) / 0.8) ** 2)) * (1 - armK);
    v[0] -= sg * Math.min(ax, 1.4) * 0.06 * k * waist;
    // fuller chest (pectorals forward) and thicker back (lats)
    const pec = Math.exp(-(((v[1] - (sy - 0.9)) / 0.55) ** 2)) * Math.exp(-(((ax - 0.75) / 0.6) ** 2)) * (1 - armK);
    if (v[2] > 0.3) v[2] += 0.08 * k * pec;
    const lat = Math.exp(-(((v[1] - (sy - 1.5)) / 0.8) ** 2)) * ssT(0.6, 1.3, ax) * (1 - armK);
    if (v[2] < 0.4) v[0] += sg * 0.06 * k * lat;
  }
}
const BUILD_K = { lean: 0.8, athletic: 1, power: 1.12, massive: 1.15 };
for (const [name, list] of Object.entries(VARIANTS)) { const V = o.V.map((v) => v.slice()); for (const [t, w] of list) applyTarget(V, T(t), w); waterPoloBuild(V, BUILD_K[name]); meshes[name] = V; }
const A = meshes.athletic, J = joints(o, A);
// Frame: metres, athletic build 1.84 m tall, shoulders at torso y = +0.07, origin on the spine axis.
let yMin = 1e9, yMax = -1e9; for (const f of o.groups.body) for (const [vi] of f) { yMin = Math.min(yMin, A[vi][1]); yMax = Math.max(yMax, A[vi][1]); }
const S = 1.9 / (yMax - yMin), OY = J['l-shoulder'][1] - 0.07 / S, OZ = J['spine-1'][2];
const M = (p) => [p[0] * S, (p[1] - OY) * S, (p[2] - OZ) * S];
// Head removed above the neck (the scanned head starts ~0.16 m below the eyes).
const CUT = J['l-eye'][1] - 0.135 / S;
console.log('S', S.toFixed(4), 'OY', OY.toFixed(2), 'CUT', CUT.toFixed(2), 'eye', J['l-eye'][1].toFixed(2), 'neck', J.neck[1].toFixed(2));
const tris = [];
for (const f of o.groups.body) {
  const ids = f.map(([vi]) => vi);
  if (ids.every((vi) => A[vi][1] > CUT)) continue;
  for (let k = 1; k + 1 < ids.length; k++) tris.push(ids[0], ids[k], ids[k + 1]);
}
const map = new Map(), verts = []; for (const v of tris) if (!map.has(v)) { map.set(v, verts.length); verts.push(v); }
const nv = verts.length, idx = Uint16Array.from(tris.map((v) => map.get(v)));
// --- skin weights (bone names, 2 influences)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a), nrm = (a) => { const l = len(a); return a.map((x) => x / l); };
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const BONES = ['torso', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'hipL', 'knL', 'hipR', 'knR', 'smL', 'smR'];
const bi = (n) => BONES.indexOf(n);
const chain = (s) => { const c = s > 0 ? 'l' : 'r'; return { sh: J[`${c}-shoulder`], el: J[`${c}-elbow`], wr: J[`${c}-hand`], hip: J[`${c}-upper-leg`], kn: J[`${c}-knee`], an: J[`${c}-ankle`], tag: s > 0 ? 'L' : 'R' }; };
const W4 = new Float32Array(nv * 4), B4 = new Uint8Array(nv * 4), suit = new Uint8Array(nv);
for (let k = 0; k < nv; k++) {
  const p = A[verts[k]], side = p[0] >= 0 ? 1 : -1, c = chain(side);
  const infl = { torso: 1 };
  // arm: along the upper-arm axis from the shoulder, within the arm radius
  const ua = nrm(sub(c.el, c.sh)), Lua = len(sub(c.el, c.sh)), d = sub(p, c.sh), t = dot(d, ua), perp = len(sub(d, ua.map((x) => x * t)));
  const fa = nrm(sub(c.wr, c.el)), Lfa = len(sub(c.wr, c.el)), d2 = sub(p, c.el), t2 = dot(d2, fa), perp2 = len(sub(d2, fa.map((x) => x * t2)));
  // arm membership: close to the arm chain (shoulder -> elbow -> wrist -> fingertips), away from the body axis
  const segD = (a, b) => { const ab = sub(b, a), tt = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return len(sub(p, a.map((x, i) => x + ab[i] * tt))); };
  const tip = J[`${side > 0 ? 'l' : 'r'}-finger-3-4`];
  const dArm = Math.min(segD(c.sh, c.el), segD(c.el, c.wr), segD(c.wr, tip.map((x, i) => x + (tip[i] - c.wr[i]) * 0.4)));
  // smooth arm membership (no hard edge): near the chain and away from the body axis
  const shx = Math.abs(c.sh[0]);
  const armness = Math.max(ss(1.05, 0.7, dArm) * ss(0.85, 1.3, Math.abs(p[0])), ss(shx + 0.15, shx + 0.6, Math.abs(p[0]))) * ss(c.hip[1] - 0.5, c.hip[1], p[1]);   // never the legs
  const legY = c.hip[1];
  if (armness > 0.001) {
    // shoulder: torso -> half-way bone (sm) -> arm bone, then elbow and wrist blends
    const wSm = ss(-0.45, 0.05, t), wSh = ss(0.0, 0.55, t);
    const wEl = ss(-0.3, 0.3, t - Lua), wWr = ss(-0.15, 0.25, t2 - Lfa);
    const armW = wSh * (1 - wEl) + 0;
    const A = armness;
    infl.torso = 1 - wSm * A; infl['sm' + c.tag] = A * wSm * (1 - wSh);
    infl['sh' + c.tag] = A * wSm * wSh * (1 - wEl); infl['el' + c.tag] = A * wSm * wSh * wEl * (1 - wWr); infl['wr' + c.tag] = A * wSm * wSh * wEl * wWr;
  } else if (p[1] < legY + 0.9 && Math.abs(p[0]) > 0.04) {
    const wLeg = ss(legY + 0.7, legY - 0.6, p[1] + 0.35 * Math.max(0, 1.3 - Math.abs(p[0])));   // inguinal crease, lower inside
    const kd = nrm(sub(c.kn, c.hip)), Lth = len(sub(c.kn, c.hip)), tk = dot(sub(p, c.hip), kd), wKn = ss(-0.45, 0.35, tk - Lth);
    infl.torso = 1 - wLeg; infl['hip' + c.tag] = wLeg * (1 - wKn); infl['kn' + c.tag] = wLeg * wKn;
  } else if (p[1] > J.neck[1]) {
    const wH = ss(J.neck[1] - 0.1, CUT - 0.02, p[1]); infl.torso = 1 - wH; infl.head = wH;
  }
  const top = Object.entries(infl).filter(([, w]) => w > 0.002).sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((a, [, w]) => a + w, 0);
  top.forEach(([n, w], j) => { B4[k * 4 + j] = bi(n); W4[k * 4 + j] = w / tot; });
  // suit (briefs): low waist, leg openings rising to the hip side
  const ax = Math.abs(p[0]), front = p[2] > 0.2;
  const hy = J['l-upper-leg'][1], waist = hy + 0.75 - (front ? 0.15 : 0) - 0.12 * ss(0.4, 1.6, ax), leg = hy - 1.15 + 0.85 * ss(0.25, 1.55, ax) + (p[2] < -0.3 ? -0.25 : 0);
  suit[k] = p[1] < waist && p[1] > leg && ax < 2.0 ? (p[1] > waist - 0.14 || p[1] < leg + 0.12 ? 200 : 255) : 0;   // 200 = trim bands
}
// --- muscle definition (unsharp mask on the surface) + baked cavity occlusion
const adj = Array.from({ length: nv }, () => new Set());
for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c2 = idx[t + 2]; adj[a].add(b).add(c2); adj[b].add(a).add(c2); adj[c2].add(a).add(b); }
const smooth = (P, it) => { let cur = P.map((p) => p.slice()); for (let k = 0; k < it; k++) { const nx = cur.map((p, i) => { const s3 = [0, 0, 0]; for (const j of adj[i]) for (let d = 0; d < 3; d++) s3[d] += cur[j][d]; const n = adj[i].size || 1; return s3.map((x, d) => x / n * 0.5 + p[d] * 0.5); }); cur = nx; } return cur; };
const vnorm = (P) => { const N = P.map(() => [0, 0, 0]); for (let t = 0; t < idx.length; t += 3) { const [a, b, c2] = [idx[t], idx[t + 1], idx[t + 2]]; const e1 = sub(P[b], P[a]), e2 = sub(P[c2], P[a]); const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; for (const v of [a, b, c2]) for (let d = 0; d < 3; d++) N[v][d] += n[d]; } return N.map(nrm); };
const DEF = {}, AO = new Uint8Array(nv);
for (const [name, V] of Object.entries(meshes)) {
  const P = verts.map((vi) => V[vi].slice()), S4 = smooth(P, 4);
  // sharpen the mid-frequency shape (muscle bellies, grooves) on torso, arms and legs; not hands, feet, neck
  const out = P.map((p, i) => { const w = (p[1] < J.neck[1] - 0.2 && p[1] > J['l-ankle'][1] + 0.6 && Math.abs(p[0]) < Math.abs(J['l-hand'][0]) - 0.3) ? 0.6 : 0; return p.map((x, d) => x + (x - S4[i][d]) * w); });
  DEF[name] = out;
  if (name === 'athletic') {
    const N = vnorm(P), S1 = smooth(P, 2), S8 = smooth(P, 10);
    for (let i = 0; i < nv; i++) {
      const c1 = dot(sub(S1[i], P[i]), N[i]), c8 = dot(sub(S8[i], P[i]), N[i]);   // > 0: vertex below its surroundings (cavity)
      AO[i] = Math.round(255 * Math.max(0.45, Math.min(1, 1 - c1 * 3.0 - c8 * 0.9)));
    }
  }
}
// --- output
const jointsOut = {};
for (const [name, V] of Object.entries(meshes)) { const Jv = joints(o, V); jointsOut[name] = Object.fromEntries(['neck', 'head', 'l-shoulder', 'l-elbow', 'l-hand', 'r-shoulder', 'r-elbow', 'r-hand', 'l-upper-leg', 'l-knee', 'l-ankle', 'r-upper-leg', 'r-knee', 'r-ankle', 'l-finger-3-1', 'r-finger-3-1'].map((k) => [k, M(Jv[k]).map((x) => +x.toFixed(5))])); }
const posBufs = Object.keys(meshes).map((name) => { const a = new Float32Array(nv * 3); DEF[name].forEach((p, k) => a.set(M(p), k * 3)); return Buffer.from(a.buffer); });
for (const [name, V] of Object.entries(meshes)) { const Jv = joints(o, V), e = M(Jv['l-eye']); jointsOut[name].headBone = [0, +(e[1] - 0.09).toFixed(5), +(e[2] - 0.091).toFixed(5)]; }
const hyM = (J['l-upper-leg'][1] - OY) * S;
const header = { suitRef: { hipY: +hyM.toFixed(5), S, OZ }, nv, ni: idx.length, variants: Object.keys(meshes), bones: BONES, joints: jointsOut, source: 'MakeHuman base mesh hm08 + macro targets, CC0 1.0' };
fs.writeFileSync('./web/assets/body/body.json', JSON.stringify(header));
fs.writeFileSync('./web/assets/body/body.bin', Buffer.concat([Buffer.from(idx.buffer), ...posBufs, Buffer.from(B4.buffer), Buffer.from(W4.buffer), Buffer.from(suit.buffer), Buffer.from(AO.buffer)]));
console.log('verts', nv, 'tris', idx.length / 3, 'bytes', fs.statSync('./web/assets/body/body.bin').size);
console.log('suit', suit.filter(Boolean).length);
