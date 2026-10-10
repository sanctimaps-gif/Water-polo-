// Runs in the browser page: retargets Mixamo joint positions onto the game rig (direction matching).
async (data) => {
  const THREE = await import('/web/vendor/three.module.min.js');
  const A = await import('/web/render/athlete.js');
  await A.loadScanHead('/web/assets/head/'); await A.loadScanBody('/web/assets/body/');
  const a = new A.Athlete({ teamColor: 0x1e5bd8, capColor: 0x1e5bd8, trimColor: 0xffffff, number: 3, role: 'CENTER', bodyRole: 'CENTER', isGK: false, seed: 11, preset: { limbSeg: 10, faceDetail: true, scanHead: true } });
  const LIM = A.JOINT_LIMITS, out = [], V = (p) => new THREE.Vector3(...p);
  const W = (o) => o.getWorldPosition(new THREE.Vector3());
  const dir = (p, q) => q.clone().sub(p).normalize();
  const set = (q) => {
    a.root.position.set(0, 0, 0); a.root.rotation.set(0, 0, 0);
    a.pivot.rotation.set(q.pitch, 0, q.roll); a.torso.rotation.set(0, q.pelvisY, q.pelvisZ); a.chest.rotation.set(q.chestX, q.chestY, q.chestZ);
    a.head.rotation.set(q.neck + q.headX, q.headY, 0);
    a.armR.sh.rotation.set(q.shRx, q.shRy, q.shRz, 'XZY'); a.armR.el.rotation.set(q.elR, 0, 0); a.armL.sh.rotation.set(q.shLx, q.shLy, q.shLz, 'XZY'); a.armL.el.rotation.set(q.elL, 0, 0);
    a.legR.hip.rotation.set(q.hipRx, 0, q.hipRz); a.legR.kn.rotation.set(q.knR, 0, 0); a.legL.hip.rotation.set(q.hipLx, 0, q.hipLz); a.legL.kn.rotation.set(q.knL, 0, 0);
    a.root.updateMatrixWorld(true);
  };
  const q = { pitch: 0, roll: 0, pelvisY: 0, pelvisZ: 0, chestX: 0, chestY: 0, chestZ: 0, twist: 0, neck: 0, headX: 0, headY: 0, shRx: 0, shRz: 0, shRy: 0, shLy: 0, elR: 0, shLx: 0, shLz: 0, elL: 0, hipRx: 0, hipRz: 0, knR: 0, knRy: 0, hipLx: 0, hipLz: 0, knL: 0, knLy: 0, rise: 0 };
  set(q);
  // which of our arms / legs is on the character's right (x < 0 when facing +z)
  const armRight = W(a.armR.sh).x < 0 ? 'R' : 'L', legRight = W(a.legR.hip).x < 0 ? 'R' : 'L';
  const ARM = { R: a.armR, L: a.armL }, LEG = { R: a.legR, L: a.legL };
  const side = (ours, right) => (ours === right ? 'Right' : 'Left');   // Mixamo side of our limb
  const shinLen = W(a.legR.kn).distanceTo(W(a.legR.hip)) * 0.95;
  const ank = (leg) => leg.kn.localToWorld(new THREE.Vector3(0, -shinLen, 0));
  const opt = (keys, err) => {
    let best = err();
    for (const st of [0.3, 0.15, 0.08, 0.04, 0.02, 0.01, 0.005]) for (let it = 0; it < 12; it++) {
      let moved = false;
      for (const k of keys) for (const s of [st, -st]) {
        const o = q[k]; let v = o + s; if (LIM[k]) v = Math.min(LIM[k][1], Math.max(LIM[k][0], v));
        if (v === o) continue; q[k] = v; set(q); const e = err(); if (e < best - 1e-9) { best = e; moved = true; } else q[k] = o;
      }
      if (!moved) break;
    }
    set(q); return best;
  };
  const mis = (u, v) => 1 - u.dot(v);
  const errs = [];
  const hip0 = data.frames.reduce((s, f) => s + f.Hips[1], 0) / data.frames.length;
  const scale = W(a.legR.hip).distanceTo(ank(a.legR)) / V(data.frames[0].RightUpLeg).distanceTo(V(data.frames[0].RightFoot));
  for (const f of data.frames) {
    const M = (k) => V(f[k]);
    // torso: pelvis and thorax frames (up + right)
    const pUp = dir(M('Hips'), M('Spine2')), pR = dir(M('LeftUpLeg'), M('RightUpLeg')), cUp = dir(M('Spine2'), M('Neck')), cR = dir(M('LeftArm'), M('RightArm'));
    const rightOf = (o1, o2, ours) => (ours === 'R' ? dir(W(o2), W(o1)) : dir(W(o1), W(o2)));
    const reg = (ks) => ks.reduce((s, k) => s + q[k] * q[k], 0) * 0.002;
    const eT = opt(['pitch', 'roll', 'pelvisY', 'pelvisZ', 'chestX', 'chestY', 'chestZ'], () => {
      const ourPR = legRight === 'R' ? dir(W(a.legL.hip), W(a.legR.hip)) : dir(W(a.legR.hip), W(a.legL.hip));
      const ourCR = armRight === 'R' ? dir(W(a.armL.sh), W(a.armR.sh)) : dir(W(a.armR.sh), W(a.armL.sh));
      return mis(new THREE.Vector3(0, 1, 0).transformDirection(a.torso.matrixWorld), pUp) + mis(ourPR, pR) + mis(dir(W(a.chest), W(a.head)), cUp) + mis(ourCR, cR) + reg(['roll', 'pelvisZ']);
    });
    // head: up axis
    const hUp = dir(M('Head'), M('HeadTop_End'));
    opt(['headX', 'headY'], () => mis(new THREE.Vector3(0, 1, 0).transformDirection(a.head.matrixWorld), hUp) + reg(['headY']));
    // arms
    let eA = 0;
    for (const s of ['R', 'L']) {
      const m = side(s, armRight), arm = ARM[s], u = dir(M(m + 'Arm'), M(m + 'ForeArm')), fo = dir(M(m + 'ForeArm'), M(m + 'Hand'));
      eA += opt(['sh' + s + 'x', 'sh' + s + 'z', 'sh' + s + 'y', 'el' + s], () => mis(dir(W(arm.sh), W(arm.el)), u) * 2 + mis(dir(W(arm.el), W(arm.wr)), fo));
    }
    let eL = 0;
    for (const s of ['R', 'L']) {
      const m = side(s, legRight), leg = LEG[s], th = dir(M(m + 'UpLeg'), M(m + 'Leg')), sh = dir(M(m + 'Leg'), M(m + 'Foot'));
      eL += opt(['hip' + s + 'x', 'hip' + s + 'z', 'kn' + s], () => mis(dir(W(leg.hip), W(leg.kn)), th) * 2 + mis(dir(W(leg.kn), ank(leg)), sh));
    }
    q.rise = (f.Hips[1] - hip0) * scale;
    errs.push([eT, eA, eL].map((x) => +x.toFixed(3)));
    const row = {}; for (const k in q) row[k] = +q[k].toFixed(4); out.push(row);
  }
  return { armRight, legRight, scale, errs, frames: out };
}
