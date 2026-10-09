// Aquatic arena: environment reflections, sports lighting, wet deck, lane ropes, floating goals with
// dynamic nets, stands with a GPU-animated crowd (reacting by sections), roof with light panels,
// giant score screen, banners, volumetric light shafts.
import * as THREE from '../vendor/three.module.min.js';
import { mergeParts } from './athlete.js';
import { POOL } from './water.js';

const HL = POOL.length / 2, HW = POOL.width / 2;
const std = (color, roughness = 0.5, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

// ---------------------------------------------------------------- ambiences
export const AMBIENCES = {
  EVENT: { bg: 0x070c16, fog: 0x0b1626, fogNear: 38, fogFar: 95, hemiSky: 0xbfd9ff, hemiGround: 0x0b2a40, hemi: 0.55, key: 2.4, keyColor: 0xfff3e0, panels: 0xffffff, panelGlow: 2.6 },
  DAY: { bg: 0x9ec4e6, fog: 0xa9c9e6, fogNear: 45, fogFar: 120, hemiSky: 0xe6f2ff, hemiGround: 0x2a5a70, hemi: 0.95, key: 2.0, keyColor: 0xffffff, panels: 0xe8f2ff, panelGlow: 1.2 },
  EVENING: { bg: 0x1a1020, fog: 0x2a1c2a, fogNear: 40, fogFar: 100, hemiSky: 0xffd2b0, hemiGround: 0x1a2a40, hemi: 0.6, key: 2.1, keyColor: 0xffd9a8, panels: 0xffe0b8, panelGlow: 2.2 },
  NIGHT: { bg: 0x03060c, fog: 0x050a14, fogNear: 34, fogFar: 85, hemiSky: 0x9fc2ff, hemiGround: 0x061826, hemi: 0.4, key: 2.6, keyColor: 0xe8f0ff, panels: 0xf0f6ff, panelGlow: 3 },
};

// ---------------------------------------------------------------- dynamic goal net
class Net {
  constructor(parent, side, lines) {
    this.side = side; this.nu = lines; this.nv = 9;
    const n = this.nu * this.nv;
    this.base = new Float32Array(n * 3); this.disp = new Float32Array(n); this.vel = new Float32Array(n);
    const x0 = side * HL, D = 0.62, H = 0.9;
    for (let j = 0; j < this.nv; j++) {
      const v = j / (this.nv - 1), path = v * (D + H + 0.15);
      for (let i = 0; i < this.nu; i++) {
        const z = -1.5 + 3 * (i / (this.nu - 1));
        const k = (j * this.nu + i) * 3;
        if (path <= D) { this.base[k] = x0 + side * path; this.base[k + 1] = H; }
        else { this.base[k] = x0 + side * D; this.base[k + 1] = H - (path - D); }
        this.base[k + 2] = z;
      }
    }
    const idx = [];
    for (let j = 0; j < this.nv; j++) for (let i = 0; i < this.nu; i++) {
      const a = j * this.nu + i;
      if (i + 1 < this.nu) idx.push(a, a + 1);
      if (j + 1 < this.nv) idx.push(a, a + this.nu);
    }
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.base);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(idx);
    const m = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0.75 }));
    parent.add(m);
    // Side panels (static).
    const sideIdx = [], sidePos = [];
    for (const z of [-1.5, 1.5]) for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      sidePos.push(x0, H * t, z, x0 + side * D, H * t, z, x0 + side * D * t, H, z, x0 + side * D * t, -0.1, z);
    }
    for (let i = 0; i < sidePos.length / 3; i += 2) sideIdx.push(i, i + 1);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sidePos, 3)); sg.setIndex(sideIdx);
    parent.add(new THREE.LineSegments(sg, m.material));
    this.energy = 0;
  }
  /** Ball hits the net at (z, y) with speed s. */
  hit(z, y, speed) {
    for (let j = 0; j < this.nv; j++) for (let i = 0; i < this.nu; i++) {
      const k = j * this.nu + i, bz = this.base[k * 3 + 2], by = this.base[k * 3 + 1];
      const d2 = (bz - z) ** 2 + (by - y) ** 2;
      this.vel[k] += Math.exp(-d2 * 6) * speed * 0.9;
    }
    this.energy = 1;
  }
  update(dt) {
    if (this.energy < 0.001) return;
    const nu = this.nu, nv = this.nv; let e = 0;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const k = j * nu + i;
      if (j === 0 || i === 0 || i === nu - 1) { this.disp[k] = 0; this.vel[k] = 0; continue; }   // tied to the frame
      const lap = (this.disp[k - 1] + this.disp[k + 1] + this.disp[k - nu] + (j + 1 < nv ? this.disp[k + nu] : this.disp[k])) / 4 - this.disp[k];
      this.vel[k] += (-this.disp[k] * 55 + lap * 220 - this.vel[k] * 5.5) * dt;
    }
    for (let k = 0; k < nu * nv; k++) {
      this.disp[k] += this.vel[k] * dt; e += Math.abs(this.disp[k]) + Math.abs(this.vel[k]) * 0.1;
      const d = Math.max(-0.05, this.disp[k]);
      this.pos[k * 3] = this.base[k * 3] + this.side * d;
      this.pos[k * 3 + 1] = this.base[k * 3 + 1] + d * 0.25;
    }
    this.energy = e;
    this.geo.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- arena
export class Arena {
  constructor(scene, renderer, preset, ambience = 'EVENT') {
    this.scene = scene; this.preset = preset;
    this.group = new THREE.Group(); scene.add(this.group);
    this.uniforms = { uTime: { value: 0 }, uExcite: { value: new THREE.Vector3(0, 0, 0) } };
    this.excite = [0, 0, 0];

    this.buildEnvironment(renderer);
    this.buildLights();
    this.buildDeck();
    this.buildRopes();
    this.nets = [this.buildGoal(-1), this.buildGoal(1)];
    this.buildBuilding();
    this.buildCrowd(preset.crowd);
    this.buildScreen();
    if (preset.shafts) this.buildShafts();
    this.setAmbience(ambience);
    this.drawCallsSaved = mergeStatic(this.group);
  }

  // Environment map for reflections on wet skin, ball, metal, deck: dark hall + bright roof panels.
  buildEnvironment(renderer) {
    const env = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x0d1830, side: THREE.BackSide }));
    env.add(room);
    const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let x = -24; x <= 24; x += 8) for (let z = -18; z <= 18; z += 9) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), panelMat); p.position.set(x, 14.5, z); p.rotation.x = Math.PI / 2; env.add(p);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x0b4f78 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2; env.add(floor);
    const stands = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), new THREE.MeshBasicMaterial({ color: 0x1a2236 })); stands.position.set(0, 4, 25); stands.rotation.y = Math.PI; env.add(stands);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(env, 0.02).texture;
    pmrem.dispose();
    this.scene.environment = this.envMap;
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x0b2a40, 0.55); this.scene.add(this.hemi);
    const key = new THREE.DirectionalLight(0xfff3e0, 2.4);
    key.position.set(-6, 22, -10);
    key.castShadow = this.preset.shadows;
    key.shadow.mapSize.set(this.preset.shadowMap, this.preset.shadowMap);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 5, far: 50 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    this.scene.add(key); this.scene.add(key.target);
    this.key = key;
    // Cool rim light from the far side (sports TV look).
    const rim = new THREE.DirectionalLight(0x8fc8ff, 0.7); rim.position.set(8, 12, 20); this.scene.add(rim);
  }

  /** Shadow frustum follows the action (sharp shadows where it matters). */
  focusShadows(x, z) {
    this.key.target.position.set(x, 0, z);
    this.key.position.set(x - 6, 22, z - 10);
  }

  buildDeck() {
    const g = this.group;
    const wet = std(0xc9d6e0, 0.16, 0.0, { envMapIntensity: 1.2 });
    const W = POOL.length + POOL.marginX * 2, D = POOL.width + POOL.marginZ * 2;
    const deck = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), wet); m.position.set(x, 0.15, z); m.receiveShadow = true; g.add(m); };
    deck(W + 16, 7, 0, -D / 2 - 3.5); deck(W + 16, 4, 0, D / 2 + 2);
    deck(8, D, -W / 2 - 4, 0); deck(8, D, W / 2 + 4, 0);
    // Rounded white gutter / curb around the basin.
    const curb = std(0xf4f7fa, 0.3);
    for (const [w, d, x, z] of [[W + 0.5, 0.25, 0, -D / 2 - 0.12], [W + 0.5, 0.25, 0, D / 2 + 0.12], [0.25, D, -W / 2 - 0.12, 0], [0.25, D, W / 2 + 0.12, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), curb); m.position.set(x, 0.32, z); g.add(m);
    }
    // Field markers on the near/far deck edges: red 2 m, yellow 5 m, green 6 m, white half line.
    const mk = [[2, 0xe0242a], [5, 0xf2c81a], [6, 0x1fb04c]];
    for (const zSide of [-D / 2 - 0.45, D / 2 + 0.45]) {
      for (const s of [-1, 1]) for (const [d, c] of mk) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.22), std(c, 0.4)); m.position.set(s * (HL - d), 0.48, zSide); g.add(m);
      }
      const half = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.22), std(0xffffff, 0.4)); half.position.set(0, 0.48, zSide); g.add(half);
    }
    // Team benches & officials table on the near deck (seen in replays / wide shots).
    const bench = std(0x1d2a40, 0.6);
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 0.6), bench); b.position.set(s * 7, 0.55, -D / 2 - 5.5); g.add(b); }
  }

  buildRopes() {
    const per = Math.round(POOL.length / 0.13);
    const geo = new THREE.CylinderGeometry(0.065, 0.065, 0.11, 10).rotateZ(Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, std(0xffffff, 0.35, 0, { envMapIntensity: 0.8 }), per * 2);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    let i = 0;
    for (const z of [-HW, HW]) for (let k = 0; k < per; k++) {
      const x = -HL + (k + 0.5) * (POOL.length / per), fromGoal = HL - Math.abs(x);
      m.makeTranslation(x, 0.02, z); mesh.setMatrixAt(i, m);
      const hex = fromGoal < 2 ? 0xd81a1a : fromGoal < 5 ? 0xf2cc19 : fromGoal < 6 ? 0x19b340 : (k % 2 ? 0xffffff : 0x2a6fd6);
      mesh.setColorAt(i++, c.setHex(hex));
    }
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  buildGoal(side) {
    const g = new THREE.Group(); this.group.add(g);
    const x = side * HL, white = std(0xffffff, 0.25, 0.3), float = std(0xf28c1a, 0.45);
    const tube = (len, x0, y0, z0, rx, rz, r = 0.045, m = white) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), m); t.position.set(x0, y0, z0); t.rotation.set(rx, 0, rz); t.castShadow = true; g.add(t); return t;
    };
    tube(1.25, x, 0.3, -1.5, 0, 0); tube(1.25, x, 0.3, 1.5, 0, 0);          // posts (from under water)
    tube(3.09, x, 0.9, 0, Math.PI / 2, 0);                                  // crossbar
    tube(3.0, x + side * 0.62, 0.9, 0, Math.PI / 2, 0, 0.025);              // back top bar
    for (const z of [-1.5, 1.5]) tube(0.62, x + side * 0.31, 0.9, z, 0, Math.PI / 2, 0.025);
    // Floating pontoons that keep the goal afloat.
    tube(3.4, x + side * 0.7, 0.0, 0, Math.PI / 2, 0, 0.13, float);
    for (const z of [-1.6, 1.6]) tube(0.8, x + side * 0.38, 0.0, z, 0, Math.PI / 2, 0.11, float);
    return new Net(g, side, this.preset.netLines);
  }

  buildBuilding() {
    const g = this.group;
    const wall = std(0x162238, 0.85), wall2 = std(0x0f1828, 0.9);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(new THREE.BoxGeometry(80, 18, 1), wall, 0, 8, 30);
    add(new THREE.BoxGeometry(80, 18, 1), wall2, 0, 8, -24);
    add(new THREE.BoxGeometry(1, 18, 56), wall2, -36, 8, 3); add(new THREE.BoxGeometry(1, 18, 56), wall2, 36, 8, 3);
    add(new THREE.BoxGeometry(80, 0.6, 56), std(0x0a111d, 0.9), 0, 15.3, 3);
    // Roof trusses.
    const truss = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.8, 54), std(0x3a4658, 0.5, 0.6), 13);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 13; i++) { m4.makeTranslation(-36 + i * 6, 14.4, 3); truss.setMatrixAt(i, m4); }
    g.add(truss);
    // Light panels exactly where the water shader reflects them (cells 6 m x 5 m).
    const panels = [];
    for (let x = -27; x <= 27; x += 6) for (let z = -22.5; z <= 22.5; z += 5) panels.push([x, z]);
    this.panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    // round stadium lamps (as on broadcast images) + a soft additive halo under each one
    const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.75, 0.14, 20), this.panelMat, panels.length);
    panels.forEach(([x, z], i) => { m4.makeTranslation(x, 13.9, z); pm.setMatrixAt(i, m4); });
    g.add(pm);
    const hc = document.createElement('canvas'); hc.width = hc.height = 64; const hg = hc.getContext('2d'), grd = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.25, 'rgba(255,248,230,0.35)'); grd.addColorStop(1, 'rgba(255,248,230,0)'); hg.fillStyle = grd; hg.fillRect(0, 0, 64, 64);
    const halo = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.2, 4.2).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), panels.length);
    panels.forEach(([x, z], i) => { m4.makeTranslation(x, 13.8, z); halo.setMatrixAt(i, m4); });
    halo.renderOrder = 3; g.add(halo);
    // Far-side stands (main), ends and a balcony with original banners.
    const seat = std(0x1d3a66, 0.7), seat2 = std(0x14294a, 0.7);
    for (let r = 0; r < 9; r++) add(new THREE.BoxGeometry(46, 0.55, 1.15), r % 2 ? seat : seat2, 0, 0.6 + r * 0.62, 13.6 + r * 1.05);
    for (const s of [-1, 1]) for (let r = 0; r < 6; r++) add(new THREE.BoxGeometry(1.15, 0.55, 18), r % 2 ? seat : seat2, s * (21 + r * 1.05), 0.6 + r * 0.62, 2);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(46, 1.1), new THREE.MeshBasicMaterial({ map: bannerTexture() }));
    banner.position.set(0, 6.45, 23.1); banner.rotation.y = Math.PI; g.add(banner);
    const banner2 = banner.clone(); banner2.position.set(0, 0.95, 13.0); banner2.scale.set(1, 0.7, 1); g.add(banner2);
  }

  /** Dense crowd painted on the stand slopes (hundreds of small spectators per tile), 1 draw call per stand. */
  buildCrowdBackdrop() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#1c2c48'; g.fillRect(0, 0, 512, 256);
    const shirts = ['#1e5bd8', '#d8321e', '#ffffff', '#202020', '#2fbf71', '#f2c81a', '#6a3fd0', '#0fb5c9', '#e87a2a', '#c8ccd4', '#8a1538', '#3a6ea5'];
    const skins = ['#f1c7a6', '#e0ac87', '#c68b62', '#8a5a3a', '#5a3622'], hair = ['#1d140f', '#3a2818', '#6b4a2a', '#c9a26b', '#2a2a2a', '#888'];
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 26; i++) {   // 4 rows x 26 people per tile, back rows first
      const x = i * 19.7 + (row % 2) * 9.8 + rnd() * 4, y = 30 + row * 64 + rnd() * 6, sh = shirts[(rnd() * shirts.length) | 0];
      g.fillStyle = sh; g.beginPath(); g.ellipse(x, y + 26, 9, 16, 0, 0, Math.PI * 2); g.fill();          // torso
      if (rnd() < 0.18) { g.strokeStyle = sh; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 6, y + 16); g.lineTo(x - 10, y - 8); g.moveTo(x + 6, y + 16); g.lineTo(x + 11, y - 6); g.stroke(); }   // arms up
      g.fillStyle = skins[(rnd() * skins.length) | 0]; g.beginPath(); g.arc(x, y + 4, 7, 0, Math.PI * 2); g.fill();   // head
      g.fillStyle = hair[(rnd() * hair.length) | 0]; g.beginPath(); g.arc(x, y + 1, 7, Math.PI, 0); g.fill();       // hair
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    // a slope through the noses of the steps; u = metres / 6 (26 people), v = rows / 4
    const slope = (p0, p1, across, rows) => {
      const geo = new THREE.BufferGeometry(), [a0, a1] = across;
      const P = [...a0(p0), ...a1(p0), ...a0(p1), ...a1(p1)];
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      const U = across.len / 6, V = rows / 4;
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, U, 0, 0, V, U, V], 2));
      geo.setIndex([0, 2, 1, 1, 2, 3]); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.material.side = THREE.DoubleSide; this.group.add(m);
    };
    // main stand (9 rows): from (y 0.9, z 13.0) to (y 6.4, z 22.5), x -23..23
    const main = [(p) => [-23, p[0], p[1]], (p) => [23, p[0], p[1]]]; main.len = 46;
    slope([0.92, 13.02], [6.5, 22.47], main, 9);
    for (const s of [-1, 1]) {   // end stands (6 rows)
      const end = [(p) => [s * p[1], p[0], -7], (p) => [s * p[1], p[0], 11]]; end.len = 18;
      slope([0.92, 20.42], [4.64, 26.72], end, 6);
    }
  }

  buildCrowd(count) {
    this.buildCrowdBackdrop();
    if (count <= 0) return;
    const spots = [];
    for (let r = 0; r < 9; r++) for (let i = 0; i < 64; i++) spots.push([-22.5 + i * 0.7 + (r % 2) * 0.35, 1.2 + r * 0.62, 13.6 + r * 1.05, 0]);
    for (const s of [-1, 1]) for (let r = 0; r < 6; r++) for (let i = 0; i < 24; i++) spots.push([s * (21 + r * 1.05), 1.2 + r * 0.62, -9 + i * 0.72, s]);
    // Keep a spread-out subset when the budget is smaller (LOD by density).
    const chosen = spots.filter((_, i) => (i * 7919) % spots.length < count).slice(0, count);
    // Distant spectators: low-poly silhouettes (~44 triangles each), instanced = 2 draw calls for the whole crowd.
    const body = mergeParts([{ geo: new THREE.CylinderGeometry(0.15, 0.19, 0.5, 6), color: new THREE.Color(0xffffff), pos: new THREE.Vector3(0, 0.1, 0) }]);
    const head = mergeParts([{ geo: new THREE.IcosahedronGeometry(0.11, 0), color: new THREE.Color(0xffffff), pos: new THREE.Vector3(0, 0.47, 0) }]);
    const patch = (mat) => {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.uniforms.uTime; sh.uniforms.uExcite = this.uniforms.uExcite;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec3 uExcite;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            float seed = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
            float ex = ip.x < -7.0 ? uExcite.x : (ip.x > 7.0 ? uExcite.z : uExcite.y);
            transformed.y += ex * abs(sin(uTime * (7.0 + seed * 4.0) + seed * 20.0)) * 0.32 + sin(uTime * 1.3 + seed * 30.0) * 0.015;`);
      };
      mat.customProgramCacheKey = () => 'crowd';
      return mat;
    };
    const bodies = new THREE.InstancedMesh(body, patch(new THREE.MeshLambertMaterial()), chosen.length);
    const heads = new THREE.InstancedMesh(head, patch(new THREE.MeshLambertMaterial()), chosen.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    const shirts = [0x1e5bd8, 0xd8321e, 0xffffff, 0x1a1a1a, 0x2fbf71, 0xf2c81a, 0x6a3fd0, 0x0fb5c9];
    const skins = [0xf1c7a6, 0xe0ac87, 0xc68b62, 0x8a5a3a, 0x5a3622];
    chosen.forEach(([x, y, z, endSide], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), endSide ? (endSide > 0 ? -Math.PI / 2 : Math.PI / 2) : Math.PI);
      sc.setScalar(0.9 + Math.random() * 0.2);
      m4.compose(new THREE.Vector3(x, y, z), q, sc);
      bodies.setMatrixAt(i, m4); heads.setMatrixAt(i, m4);
      bodies.setColorAt(i, c.setHex(shirts[(Math.random() * shirts.length) | 0]).multiplyScalar(0.8 + Math.random() * 0.3));
      heads.setColorAt(i, c.setHex(skins[(Math.random() * skins.length) | 0]));
    });
    this.group.add(bodies, heads);
  }

  buildScreen() {
    const c = document.createElement('canvas'); c.width = 768; c.height = 256;
    this.screenCanvas = c; this.screenTex = new THREE.CanvasTexture(c); this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(10.4, 3.7, 0.3), std(0x111821, 0.4, 0.6)); frame.position.set(0, 10.6, 24.4); this.group.add(frame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.33), new THREE.MeshBasicMaterial({ map: this.screenTex }));
    scr.position.set(0, 10.6, 24.2); scr.rotation.y = Math.PI; this.group.add(scr);
    this.logo = new Image(); this.logo.src = 'web/assets/logo.webp'; this.logo.onload = () => this.drawScreen(this.screenState || {});
    this.drawScreen({});
  }

  /** Live giant screen: team names, score, period clock. */
  drawScreen(st) {
    const key = JSON.stringify(st);
    if (key === this.screenKey) return;
    this.screenKey = key; this.screenState = st;
    const g = this.screenCanvas.getContext('2d'), W = 768, H = 256;
    const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, '#04122a'); grd.addColorStop(1, '#0a3a6a');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    if (this.logo.complete && this.logo.naturalWidth) g.drawImage(this.logo, 8, 28, 200, 200);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    if (st.home) {
      g.font = '800 52px "Barlow Condensed", Arial'; g.fillText(st.home, 310, 80); g.fillText(st.away, 640, 80);
      g.font = '800 120px "Barlow Condensed", Arial'; g.fillText(`${st.hs} - ${st.as}`, 475, 150);
      g.font = '600 40px "Barlow Condensed", Arial'; g.fillStyle = '#7fd8ff'; g.fillText(st.clock, 475, 225);
    } else {
      g.font = '800 64px "Barlow Condensed", Arial'; g.fillText('WATER POLO 26', 480, 110);
      g.font = '600 40px "Barlow Condensed", Arial'; g.fillStyle = '#7fd8ff'; g.fillText('AQUA ARENA', 480, 175);
    }
    this.screenTex.needsUpdate = true;
  }

  buildShafts() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(0xdfeeff) } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uCol; varying float vY; void main(){ float a = smoothstep(-6.5, 6.5, vY) * 0.05; gl_FragColor = vec4(uCol, a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const geo = new THREE.CylinderGeometry(0.9, 3.2, 13, 16, 1, true);
    for (const [x, z] of [[-15, -2.5], [-9, 2.5], [-3, -2.5], [3, 2.5], [9, -2.5], [15, 2.5]]) {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, 7.4, z); this.group.add(m);
    }
  }

  setAmbience(name) {
    const a = AMBIENCES[name] || AMBIENCES.EVENT;
    this.scene.background = new THREE.Color(a.bg);
    this.scene.fog = new THREE.Fog(a.fog, a.fogNear, a.fogFar);
    this.hemi.color.setHex(a.hemiSky); this.hemi.groundColor.setHex(a.hemiGround); this.hemi.intensity = a.hemi;
    this.key.intensity = a.key; this.key.color.setHex(a.keyColor);
    this.panelMat.color.setHex(a.panels).multiplyScalar(a.panelGlow);
  }

  /** section: 0 left, 1 centre, 2 right, or -1 all. amount 0..1.5 */
  cheer(section, amount) {
    for (let s = 0; s < 3; s++) if (section < 0 || s === section) this.excite[s] = Math.max(this.excite[s], amount);
  }

  netHit(side, z, y, speed) { this.nets[side > 0 ? 1 : 0].hit(z, y, speed); }

  update(dt, time) {
    this.uniforms.uTime.value = time;
    for (let s = 0; s < 3; s++) this.excite[s] = Math.max(0, this.excite[s] - dt * 0.35);
    this.uniforms.uExcite.value.set(this.excite[0], this.excite[1], this.excite[2]);
    for (const n of this.nets) n.update(Math.min(dt, 1 / 30));
  }
}

function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 64;
  const g = c.getContext('2d');
  const words = ['WATER POLO 26', 'AQUA ARENA', 'BLUEWAVE', 'HYDRA SPORT', 'OCEANIC', 'SPLASH LEAGUE'];
  g.fillStyle = '#0a1f3d'; g.fillRect(0, 0, 2048, 64);
  g.font = '800 40px "Barlow Condensed", Arial'; g.textBaseline = 'middle';
  let x = 20, i = 0;
  while (x < 2048) {
    const w = words[i++ % words.length];
    g.fillStyle = i % 2 ? '#38c8ff' : '#ffffff'; g.fillText(w, x, 34);
    x += g.measureText(w).width + 60;
    g.fillStyle = '#f2c81a'; g.fillRect(x - 38, 26, 16, 16);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/**
 * Batches every static, single-material mesh of the arena that shares a material into one mesh
 * (transforms baked). Stands, deck, markers, goal frames... go from dozens of draw calls to a few.
 */
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.dynamic) return;
    const g = o.geometry;
    if (!g.index || !g.attributes.normal || !g.attributes.uv || g.attributes.color) return;
    if (o.material.map) return;                              // textured planes keep their own draw call
    const key = o.material.uuid + (o.castShadow ? 's' : '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let saved = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    let vc = 0, ic = 0;
    for (const o of list) { vc += o.geometry.attributes.position.count; ic += o.geometry.index.count; }
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), idx = new Uint32Array(ic);
    let vo = 0, io = 0;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const o of list) {
      const g = o.geometry, P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv;
      nm.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); pos.set([v.x, v.y, v.z], (vo + i) * 3);
        v.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
        uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i);
      }
      const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo;
      vo += P.count; io += ia.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
    const merged = new THREE.Mesh(geo, list[0].material);
    merged.castShadow = list[0].castShadow; merged.receiveShadow = list.some((o) => o.receiveShadow);
    for (const o of list) { o.parent.remove(o); o.geometry.dispose(); }
    root.add(merged);
    saved += list.length - 1;
  }
  return saved;
}
