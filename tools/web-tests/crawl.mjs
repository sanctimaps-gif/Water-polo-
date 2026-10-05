// Run: node tools/web-tests/crawl.mjs — front crawl arms turn the right way: the hand moves forward
// over the water (recovery) and backward under the water (pull), for both arms.
import * as THREE from '../../web/vendor/three.module.min.js';
import { Athlete } from '../../web/render/athlete.js';
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
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
