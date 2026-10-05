// Run: node tools/web-tests/crawl.mjs — front crawl arms turn the right way: the hand moves forward
// over the water (recovery) and backward under the water (pull), for both arms.
import * as THREE from '../../web/vendor/three.module.min.js';
import { Athlete, JOINT_LIMITS } from '../../web/render/athlete.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const a = new Athlete({ teamColor: 0x1e5bd8, capColor: 0x1e5bd8, trimColor: 0xffffff, number: 3, role: 'WINGER', isGK: false, seed: 5, preset: { limbSeg: 6, faceDetail: false } });
const st = { x: 0, z: 0, fx: 0, fz: -1, vx: 0, vz: -1.6, sprint: false, hasBall: false, charging: false, charge: 0, block: 0, stamina: 1, ball: new THREE.Vector3(0, 0, -5), receive: false };
for (let i = 0; i < 60; i++) a.update(1 / 60, st);
for (const [name, arm] of [['right', a.armR], ['left', a.armL]]) {
  const v = new THREE.Vector3(); let prev = null; const n = { fa: 0, ba: 0, fb: 0, bb: 0 };
  for (let i = 0; i < 240; i++) {
    a.update(1 / 60, st); a.root.updateMatrixWorld(true); arm.hand.getWorldPosition(v);
    if (prev) { const fwd = v.z < prev.z;   // swimming toward -z
      if (v.y > 0.05) fwd ? n.fa++ : n.ba++; else if (v.y < -0.05) fwd ? n.fb++ : n.bb++; }
    prev = v.clone();
  }
  ok(n.fa > 5 * n.ba && n.bb > 5 * n.fb, `${name} arm: forward over the water ${n.fa}/${n.fa + n.ba}, backward under the water ${n.bb}/${n.bb + n.fb}`);
}
// Shoulder roll: during the right-arm pull the right shoulder is lower than the left one.
{ const r = new THREE.Vector3(), l = new THREE.Vector3(); let n = 0, k = 0;
  for (let i = 0; i < 240; i++) { a.update(1 / 60, st); a.root.updateMatrixWorld(true); a.armR.sh.getWorldPosition(r); a.armL.sh.getWorldPosition(l);
    const q = ((a.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); if (q > 3.9 && q < 5.5) { n++; if (r.y < l.y) k++; } }
  ok(n > 0 && k / n > 0.9, `shoulders roll with the stroke (${k}/${n})`); }
// Dribbling: swimming forward with the ball = head-up crawl (not the ball held overhead).
{ const d = { ...st, hasBall: true }; for (let i = 0; i < 90; i++) a.update(1 / 60, d); ok(a.dribbling && a.w.hold < 0.2, 'dribble: crawl with the ball in front'); }
// Moving backward = eggbeater facing the play, not a crawl.
{ const bk = { ...st, vz: 1.0 }; for (let i = 0; i < 90; i++) a.update(1 / 60, bk); ok(a.w.swim < 0.1, 'backward move uses the eggbeater'); }
// Joint limits: every animation state stays inside the human range of motion.
{ let bad = [];
  const states = [{}, { hasBall: true }, { hasBall: true, vz: -1.6 }, { charging: true, charge: 1, hasBall: true }, { vz: 1.2 }, { vx: 1.2, vz: 0 }, { block: 1 }];
  for (const extra of states) {
    for (let i = 0; i < 120; i++) { a.update(1 / 60, { ...st, ...extra }); if (i === 60 && extra.charging) a.playThrow('power');
      for (const [k, [lo, hi]] of Object.entries(JOINT_LIMITS)) if (a.pose[k] < lo - 1e-6 || a.pose[k] > hi + 1e-6) bad.push(k + '=' + a.pose[k].toFixed(2)); }
  }
  a.playCelebrate(); a.playDive(1); a.playReach(-1); for (let i = 0; i < 120; i++) a.update(1 / 60, st);
  ok(bad.length === 0, `joint limits respected (${bad.length ? [...new Set(bad)].slice(0, 5).join(', ') : 'all states'})`); }
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
