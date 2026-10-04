// WATER POLO 26 MOBILE — web prototype: Three.js view + touch controls + HUD over the JS simulation.
import * as THREE from './vendor/three.module.min.js';
import { Match, HOME, AWAY, Ev, TACTICS, CHARGE_TIME, EXC_MIN, EXC_MAX } from './sim.js';

// ------------------------------------------------------------------ localization (same files as the Unity project)
const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt'];
const LOC_PATH = 'WaterPolo26Mobile/Assets/_Project/Resources/Localization/';
const tables = {};
let lang = (navigator.language || 'fr').slice(0, 2);
if (!LANGS.includes(lang)) lang = 'en';
async function loadLang(code) {
  if (tables[code]) return;
  try {
    const txt = await (await fetch(LOC_PATH + code + '.txt')).text();
    const t = {};
    for (const raw of txt.split('\n')) {
      const line = raw.trim();
      if (!line || line[0] === '#') continue;
      const i = line.indexOf('=');
      if (i > 0) t[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    tables[code] = t;
  } catch { tables[code] = {}; }
}
const L = (k, ...a) => {
  let s = (tables[lang] && tables[lang][k]) || (tables.en && tables.en[k]) || k;
  a.forEach((v, i) => (s = s.replace(`{${i}}`, v)));
  return s;
};

// ------------------------------------------------------------------ options
const opts = { team: 0, difficulty: 1, assist: 'STANDARD', minutes: 2, timing: true };
const DIFF = [0.75, 1, 1.15], DIFF_KEYS = ['difficulty.easy', 'difficulty.normal', 'difficulty.hard'];
const ASSISTS = ['ASSISTED', 'STANDARD', 'PRO'];
const MINUTES = [1, 2, 4, 8];
const TACTIC_KEYS = { BALANCED: 'tactic.balanced', FAST: 'tactic.fast', OFFENSIVE: 'tactic.offensive', DEFENSIVE: 'tactic.defensive', PRESSURE: 'tactic.pressure', CENTER: 'tactic.center', COUNTER: 'tactic.counter' };

const $ = (id) => document.getElementById(id);

function renderMenu() {
  const home = HOME(), away = AWAY();
  const rows = [
    ['menu.team', (opts.team === 0 ? home : away).name, () => (opts.team = 1 - opts.team)],
    ['menu.difficulty', L(DIFF_KEYS[opts.difficulty]), () => (opts.difficulty = (opts.difficulty + 1) % 3)],
    ['menu.assist', L('assist.' + opts.assist.toLowerCase()), () => (opts.assist = ASSISTS[(ASSISTS.indexOf(opts.assist) + 1) % 3])],
    ['menu.duration', L('menu.minutes', opts.minutes), () => (opts.minutes = MINUTES[(MINUTES.indexOf(opts.minutes) + 1) % MINUTES.length])],
    ['menu.timing', L(opts.timing ? 'value.on' : 'value.off'), () => (opts.timing = !opts.timing)],
    ['menu.language', L('lang.name'), async () => { lang = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]; await loadLang(lang); }],
  ];
  $('menu-title').textContent = L('app.title');
  $('menu-sub').textContent = L('menu.quick_match');
  $('menu-hint').textContent = L('menu.controls_hint');
  $('play').textContent = L('menu.play');
  const box = $('menu-rows');
  box.innerHTML = '';
  for (const [k, v, fn] of rows) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span>${L(k)}</span><button>${v}</button>`;
    row.querySelector('button').onclick = async () => { await fn(); renderMenu(); };
    box.appendChild(row);
  }
}

// ------------------------------------------------------------------ three.js scene
const renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
$('view').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);
scene.fog = new THREE.Fog(0x0b1220, 45, 90);
const camera = new THREE.PerspectiveCamera(46, 1, 0.3, 150);
scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x203040, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-8, 20, -12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14 });
scene.add(sun);

const mat = (c, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };
const cyl = (r, h, c, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat(c, 0.4)); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); scene.add(m); return m; };

const HL = 12.5, HW = 10;
// animated water
const waterGeo = new THREE.PlaneGeometry(29, 22, 58, 44);
waterGeo.rotateX(-Math.PI / 2);
const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: 0x0e6a9a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.93 }));
water.receiveShadow = true;
scene.add(water);
box(29, 2, 22, 0x06324d, 0, -1.05, 0); // pool basin (seen through the water)
const waterBase = waterGeo.attributes.position.array.slice();
// deck
box(37, 0.4, 4, 0xd3d7dc, 0, 0.1, -13); box(37, 0.4, 4, 0xd3d7dc, 0, 0.1, 13);
box(4, 0.4, 22, 0xd3d7dc, -16.5, 0.1, 0); box(4, 0.4, 22, 0xd3d7dc, 16.5, 0.1, 0);
// lane ropes: red 0-2 m, yellow 2-5 m, green 5-6 m, white
for (const z of [-HW, HW]) for (const s of [-1, 1]) {
  const segs = [[0, 2, 0xd81a1a], [2, 5, 0xf2cc19], [5, 6, 0x19b340], [6, HL, 0xffffff]];
  for (const [a, b, c] of segs) { const x0 = s * (HL - a), x1 = s * (HL - b); cyl(0.07, Math.abs(x1 - x0), c, (x0 + x1) / 2, 0.04, z, 0, Math.PI / 2); }
}
// goals
for (const s of [-1, 1]) {
  const x = s * HL;
  cyl(0.05, 1.2, 0xffffff, x, 0.45, -1.5); cyl(0.05, 1.2, 0xffffff, x, 0.45, 1.5); cyl(0.05, 3.1, 0xffffff, x, 0.9, 0, Math.PI / 2);
  const net = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, wireframe: true });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.9, 10, 4), net); back.position.set(x + s * 0.7, 0.45, 0); back.rotation.y = Math.PI / 2; scene.add(back);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3, 3, 10), net); top.position.set(x + s * 0.35, 0.9, 0); top.rotation.x = -Math.PI / 2; scene.add(top);
  for (const z of [-1.5, 1.5]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9, 3, 4), net); sd.position.set(x + s * 0.35, 0.45, z); scene.add(sd); }
}
// stands + low-cost crowd (one instanced mesh)
for (let r = 0; r < 5; r++) box(36, 0.7, 1.3, 0x222a3a - r * 0x020202, 0, 0.6 + r * 0.75, 16.5 + r * 1.3);
const crowdCount = 360;
const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.6, 0.3), new THREE.MeshLambertMaterial(), crowdCount);
const crowdBase = [];
{
  const m = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < crowdCount; i++) {
    const r = i % 5, x = -17 + ((i / 5) | 0) * 0.47;
    crowdBase.push([x, 1.25 + r * 0.75, 16.4 + r * 1.3]);
    m.setPosition(x, crowdBase[i][1], crowdBase[i][2]); crowd.setMatrixAt(i, m);
    crowd.setColorAt(i, col.setHSL(Math.random(), 0.5, 0.35 + Math.random() * 0.3));
  }
}
scene.add(crowd);
let crowdExcite = 0;

// ------------------------------------------------------------------ actors
function numberSprite(n) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 6; g.strokeText(n, 32, 34); g.fillText(n, 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(0.45, 0.45, 1); s.position.y = 0.95; return s;
}
const skin = mat(0xedc29e);
const ringGeo = new THREE.RingGeometry(0.45, 0.58, 28).rotateX(-Math.PI / 2);
let actors = [], ballMesh, ballShadow, selRing, passRing, splashes = [];

function buildActors(m) {
  for (const a of actors) scene.remove(a.g);
  actors = [];
  for (const p of m.players) {
    const team = m.teams[p.team].def;
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.45, 4, 10), mat(team.color, 0.5)); torso.position.y = -0.25; body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin); head.position.y = 0.3; head.castShadow = true; body.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(p.isGK ? 0xd81a1f : team.color, 0.4)); cap.position.y = 0.31; body.add(cap);
    const armPivot = new THREE.Group(); armPivot.position.set(0.2, 0.12, 0); body.add(armPivot);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.45, 3, 6), skin); arm.position.y = 0.3; arm.castShadow = true; armPivot.add(arm);
    g.add(numberSprite(p.number));
    scene.add(g);
    actors.push({ p, g, body, armPivot, phase: p.id * 0.77 });
  }
  if (!ballMesh) {
    ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat(0xffd90f, 0.35)); ballMesh.castShadow = true; scene.add(ballMesh);
    ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x02283c, transparent: true, opacity: 0.5 })); scene.add(ballShadow);
    selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd91a })); scene.add(selRing);
    passRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x4dff73, transparent: true, opacity: 0.8 })); scene.add(passRing);
  }
}
function splash(x, z, size = 1) {
  const s = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.18, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
  s.position.set(x, 0.03, z); scene.add(s); splashes.push({ s, t: 0, size });
}

// ------------------------------------------------------------------ input
const input = { stick: { x: 0, y: 0, active: false }, A: btnState(), B: btnState(), pan: 0, dbl: false, keys: new Set() };
function btnState() { return { held: false, press: false, release: false, down: 0, dur: 0, sx: 0, sy: 0, swipe: { x: 0, y: 0 } }; }

function setupInput() {
  const zone = $('stick-zone'), base = $('stick'), knob = $('knob');
  let sid = null, ox = 0, oy = 0;
  const R = 70;
  zone.addEventListener('pointerdown', (e) => {
    sid = e.pointerId; try { zone.setPointerCapture(sid); } catch {} ox = e.clientX; oy = e.clientY;
    const r = zone.getBoundingClientRect();
    base.style.left = ox - r.left + 'px'; base.style.top = oy - r.top + 'px'; base.classList.add('on');
    input.stick.active = true; moveStick(e);
  });
  const moveStick = (e) => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.stick.x = dx / R; input.stick.y = -dy / R;
    base.classList.toggle('sprint', Math.hypot(input.stick.x, input.stick.y) > 0.92);
  };
  zone.addEventListener('pointermove', moveStick);
  const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; input.stick = { x: 0, y: 0, active: false }; knob.style.transform = ''; base.classList.remove('on', 'sprint'); };
  zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);

  for (const [id, st] of [['btnA', input.A], ['btnB', input.B]]) {
    const el = $(id); let pid = null, lx = 0, ly = 0;
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); pid = e.pointerId; try { el.setPointerCapture(pid); } catch {} st.held = true; st.press = true; st.down = performance.now(); st.sx = lx = e.clientX; st.sy = ly = e.clientY; el.classList.add('down'); });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === pid) { lx = e.clientX; ly = e.clientY; } });
    const up = (e) => { if (e.pointerId !== pid) return; pid = null; st.held = false; st.release = true; st.dur = (performance.now() - st.down) / 1000; st.swipe = { x: lx - st.sx, y: ly - st.sy }; el.classList.remove('down'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  const rz = $('right-zone'); let rid = null, rx = 0, lastTap = 0, moved = 0;
  rz.addEventListener('pointerdown', (e) => { rid = e.pointerId; try { rz.setPointerCapture(rid); } catch {} rx = e.clientX; moved = 0; });
  rz.addEventListener('pointermove', (e) => { if (e.pointerId !== rid) return; input.pan += e.clientX - rx; moved += Math.abs(e.clientX - rx); rx = e.clientX; });
  rz.addEventListener('pointerup', (e) => {
    if (e.pointerId !== rid) return; rid = null;
    if (moved < 10) { const now = performance.now(); if (now - lastTap < 300) { input.dbl = true; lastTap = 0; } else lastTap = now; }
  });
  addEventListener('keydown', (e) => { input.keys.add(e.code); if (e.code === 'KeyK' && !e.repeat) { input.A.held = true; input.A.press = true; input.A.down = performance.now(); input.A.swipe = { x: 0, y: 0 }; } if (e.code === 'KeyJ' && !e.repeat) { input.B.press = true; input.B.release = true; input.B.dur = 0; input.B.swipe = { x: 0, y: 0 }; } if (e.code === 'KeyL' || e.code === 'KeyQ') { input.A.press = e.code === 'KeyL'; if (e.code === 'KeyQ') input.B.press = true; } });
  addEventListener('keyup', (e) => { input.keys.delete(e.code); if (e.code === 'KeyK') { input.A.held = false; input.A.release = true; input.A.dur = (performance.now() - input.A.down) / 1000; } });
}

let aCtx = false, bCtx = false;
function pollInput(m) {
  const me = m.human; if (!me) return;
  const hasBall = m.ball.owner === me;
  let sx = input.stick.x, sy = input.stick.y;
  const k = input.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) sy += 1; if (k.has('KeyS') || k.has('ArrowDown')) sy -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) sx += 1; if (k.has('KeyA') || k.has('ArrowLeft')) sx -= 1;
  const l = Math.hypot(sx, sy); if (l > 1) { sx /= l; sy /= l; }
  const cmd = { move: screenToWorld(sx, sy), sprint: Math.hypot(sx, sy) > 0.92 || k.has('ShiftLeft') || k.has('ShiftRight') };
  currentMove = cmd.move;
  const A = input.A, B = input.B;
  if (A.press) { A.press = false; aCtx = hasBall; if (!hasBall) cmd.defend = true; }
  if (aCtx && hasBall) cmd.shootHeld = A.held;
  if (A.release) {
    A.release = false;
    if (aCtx) {
      cmd.shootReleased = true;
      const sw = A.swipe, sl = Math.hypot(sw.x, sw.y);
      if (sl > 40) {
        const s = me.team === 0 ? 1 : -1, n = innerHeight * 0.25;
        cmd.hasAim = true; cmd.aimX = Math.max(-1.2, Math.min(1.2, -s * (-sw.y / n))); cmd.aimY = Math.max(0, Math.min(1, 0.4 + (sw.x / n) * s * 0.6));
        if (A.dur < 0.2) cmd.quickShot = true;
      }
      aCtx = false;
    }
  }
  if (B.press) { B.press = false; bCtx = hasBall; if (!hasBall) m.switchHuman(); }
  if (B.release) {
    B.release = false;
    if (bCtx) {
      cmd.pass = true; const sw = B.swipe;
      cmd.passDir = Math.hypot(sw.x, sw.y) > 40 ? screenToWorld(sw.x, -sw.y, true) : cmd.move;
      cmd.lob = B.dur > 0.35; bCtx = false;
    }
  }
  if (input.dbl) { input.dbl = false; if (hasBall) cmd.quickShot = true; else m.switchHuman(); }
  userPan = Math.max(-6, Math.min(6, userPan + input.pan * 0.03)); input.pan = 0;
  m.setHumanCommand(cmd);
}
function screenToWorld(x, y, normalize) {
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); right.y = 0; right.normalize();
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  const w = right.multiplyScalar(x).add(fwd.multiplyScalar(y));
  if (normalize && w.length() > 0) w.normalize();
  return { x: w.x, y: 0, z: w.z };
}
let currentMove = { x: 0, y: 0, z: 0 };

// ------------------------------------------------------------------ match lifecycle
let match = null, prev = [], curr = [], prevBall = null, currBall = null, acc = 0, userPan = 0;
let focus = new THREE.Vector3(), goalCam = 0, goalPoint = new THREE.Vector3(), toastT = 0, timingT = 0, tacticIdx = 0;

function startMatch() {
  const cfg = { seed: (Math.random() * 1e9) | 0, humanTeam: opts.team, cpu: DIFF[opts.difficulty], assist: opts.assist, periodDuration: opts.minutes * 60, timing: opts.timing };
  match = new Match(cfg, HOME(), AWAY());
  match.start();
  snapshot(); snapshot();
  buildActors(match);
  tacticIdx = 0;
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('home-name').textContent = match.teams[0].def.short; $('away-name').textContent = match.teams[1].def.short;
  $('home-chip').style.background = hex(match.teams[0].def.color); $('away-chip').style.background = hex(match.teams[1].def.color);
  refreshTactic();
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch {}
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
function snapshot() {
  prev = curr; prevBall = currBall;
  curr = match.players.map((p) => ({ ...p.pos }));
  currBall = { ...match.ball.pos };
  if (!prev.length) { prev = curr; prevBall = currBall; }
}

function onEvent(e) {
  const human = match.human ? match.human.team : -1;
  const toastMap = { [Ev.SAVE]: 'hud.save', [Ev.BLOCK]: 'hud.blocked', [Ev.FRAME]: 'hud.frame', [Ev.INTERCEPT]: 'hud.intercepted', [Ev.STEAL]: 'hud.steal', [Ev.FOUL]: 'hud.foul', [Ev.OUT]: 'hud.out', [Ev.SHOT_CLOCK]: 'hud.shotclock_violation', [Ev.SWIM_OFF]: 'hud.swimoff' };
  if (e.type === Ev.GOAL) {
    toast(L('hud.goal'), 2.5); goalCam = 2.4; goalPoint.set(e.pos.x, 0, e.pos.z); crowdExcite = 2.5; splash(e.pos.x, e.pos.z, 2);
    if (e.team === human && navigator.vibrate) navigator.vibrate([60, 40, 120]);
  } else if (toastMap[e.type]) toast(L(toastMap[e.type]), 1.1);
  if (e.type === Ev.SAVE) crowdExcite = Math.max(crowdExcite, 1);
  if (e.type === Ev.SHOT) splash(e.pos.x, e.pos.z, 0.8);
  if (e.type === Ev.PERIOD_END) toast(L('hud.period_end', e.value), 2.5);
  if (e.type === Ev.RESTART || e.type === Ev.PERIOD_START) goalCam = 0;
  if (e.type === Ev.SHOT && e.team === human && e.timing && e.timing !== 'NONE') {
    const el = $('timing'); el.textContent = L('hud.timing.' + e.timing.toLowerCase()); el.className = 't-' + e.timing.toLowerCase(); timingT = 1.2;
  }
  if (e.type === Ev.END) showEnd(e.team, human);
}
function toast(t, s) { $('toast').textContent = t; toastT = s; }

function showEnd(winner, human) {
  const m = match, a = m.stats.teams[0], b = m.stats.teams[1];
  const title = winner < 0 ? 'result.draw' : winner === human ? 'result.win' : 'result.loss';
  $('end-title').textContent = `${L(title)}  ${m.teams[0].score} - ${m.teams[1].score}`;
  const pct = (x, y) => (y ? Math.round((100 * x) / y) : 0) + '%';
  const tot = a.possession + b.possession || 1;
  const rows = [[a.shots, 'stats.shots', b.shots], [a.saves, 'stats.saves', b.saves], [pct(a.passesOk, a.passes), 'stats.passes', pct(b.passesOk, b.passes)],
    [Math.round((100 * a.possession) / tot) + '%', 'stats.possession', Math.round((100 * b.possession) / tot) + '%'], [a.steals + a.interceptions, 'stats.steals', b.steals + b.interceptions]];
  $('end-stats').innerHTML = `<div class="sr head"><b>${m.teams[0].def.short}</b><span></span><b>${m.teams[1].def.short}</b></div>` +
    rows.map(([x, k, y]) => `<div class="sr"><b>${x}</b><span>${L(k)}</span><b>${y}</b></div>`).join('');
  $('again').textContent = L('btn.restart');
  toastT = 0; $('toast').style.opacity = 0;
  $('end').classList.remove('hidden');
}

function refreshTactic() { if (match) $('tactic').textContent = `${L('btn.tactic')}: ${L(TACTIC_KEYS[TACTICS[tacticIdx]])}`; }

// ------------------------------------------------------------------ frame
let last = performance.now(), fpsAvg = 60;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  fpsAvg += (1 / Math.max(dt, 1e-3) - fpsAvg) * 0.05;
  resize();
  animateWater(now / 1000);
  if (match && !match.finished) {
    pollInput(match);
    acc += dt; let steps = 0;
    while (acc >= match.cfg.dt && steps < 5) { match.step(); snapshot(); acc -= match.cfg.dt; steps++; for (const e of match.drain()) onEvent(e); }
    if (steps === 5) acc = 0;
  }
  if (match) { updateActors(dt); updateCamera(dt); updateHud(dt); }
  else { camera.position.set(Math.sin(now / 6000) * 14, 10, -22); camera.lookAt(0, 0, 0); }
  // crowd jump
  crowdExcite = Math.max(0, crowdExcite - dt);
  if (crowdExcite > 0 || crowd.userData.dirty) {
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < crowdCount; i++) { const b = crowdBase[i]; m4.setPosition(b[0], b[1] + (crowdExcite > 0 ? Math.abs(Math.sin(now / 120 + i)) * 0.25 : 0), b[2]); crowd.setMatrixAt(i, m4); }
    crowd.instanceMatrix.needsUpdate = true; crowd.userData.dirty = crowdExcite > 0;
  }
  for (const s of splashes) { s.t += dt; const k = 1 + s.t * 6 * s.size; s.s.scale.set(k, 1, k); s.s.material.opacity = Math.max(0, 0.8 - s.t * 1.2); }
  splashes = splashes.filter((s) => (s.t < 0.7 ? true : (scene.remove(s.s), false)));
  renderer.render(scene, camera);
}
function animateWater(t) {
  const a = waterGeo.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) { const x = waterBase[i], z = waterBase[i + 2]; a[i + 1] = Math.sin(x * 0.9 + t * 1.6) * 0.025 + Math.cos(z * 1.3 + t * 1.1) * 0.02; }
  waterGeo.attributes.position.needsUpdate = true;
}
const alpha = () => Math.min(1, acc / match.cfg.dt);
const interp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

function updateActors(dt) {
  const t = alpha();
  for (const a of actors) {
    const p = a.p, pos = interp(prev[p.id], curr[p.id], t), speed = Math.hypot(p.vel.x, p.vel.z);
    a.phase += dt * (2 + speed * 3);
    let rise = p.charging ? 0.18 * p.charge : 0; if (p.isGK) rise += 0.08; if (p.block > 0) rise += 0.12;
    a.g.position.set(pos.x, Math.sin(a.phase) * (0.02 + speed * 0.02) + rise, pos.z);
    a.body.rotation.set(0, Math.atan2(p.facing.x, p.facing.z), 0);
    a.body.children[0].rotation.x = Math.min(0.5, speed * 0.2);
    const up = p.charging || p.block > 0 || match.ball.owner === p;
    const target = up ? (p.charging ? -0.5 - 0.7 * p.charge : 0) : 2.7;
    a.armPivot.rotation.x += (target - a.armPivot.rotation.x) * Math.min(1, dt * 14);
  }
  const bp = Math.hypot(currBall.x - prevBall.x, currBall.z - prevBall.z) > 3 ? currBall : interp(prevBall, currBall, t);
  ballMesh.position.set(bp.x, bp.y, bp.z);
  ballMesh.rotation.x += match.ball.vel.z * dt * 4; ballMesh.rotation.z -= match.ball.vel.x * dt * 4;
  ballShadow.position.set(bp.x, 0.04, bp.z);
  const me = match.human;
  selRing.visible = !!me;
  if (me) { const a = actors[me.id].g.position; selRing.position.set(a.x, 0.05, a.z); }
  passRing.visible = false;
  if (me && match.ball.owner === me) {
    const tp = match.teams[me.team].tp;
    const target = match.chooseTarget(me, currentMove, match.cfg.assist, me.prof.risk, tp.center);
    if (target) { const a = actors[target.id].g.position; passRing.position.set(a.x, 0.05, a.z); passRing.visible = true; }
  }
}

function updateCamera(dt) {
  const m = match, portrait = innerHeight > innerWidth;
  const ball = ballMesh.position;
  const target = ball.clone();
  if (m.human) target.lerp(actors[m.human.id].g.position, 0.25);
  const team = m.possessionTeam;
  if (team >= 0) target.x += (team === 0 ? 1 : -1) * 2;
  target.x = Math.max(-HL + 6, Math.min(HL - 6, target.x + userPan));
  target.z = Math.max(-2, Math.min(2, target.z * 0.35)); target.y = 0;
  const near = Math.min(1, Math.max(0, (Math.abs(ball.x) - 6) / 5));
  let height = 9.5 - 1.5 * near, back = HW + 7.5 - 1.5 * near, fov = portrait ? 74 : 48 - 6 * near;
  if (goalCam > 0) { goalCam -= dt; target.set(goalPoint.x - Math.sign(goalPoint.x) * 3, 0, 0); height = 5; back = 9; fov = 38; }
  focus.lerp(target, 1 - Math.exp(-dt / 0.25));
  const desired = new THREE.Vector3(focus.x, height, focus.z - back);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
  camera.lookAt(focus.x, 0.5, focus.z);
  camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 3)); camera.updateProjectionMatrix();
  userPan += (0 - userPan) * Math.min(1, dt * 0.8);
}

function updateHud(dt) {
  const m = match;
  $('home-score').textContent = m.teams[0].score; $('away-score').textContent = m.teams[1].score;
  const t = Math.max(0, m.periodLeft);
  $('clock').textContent = `${L('hud.period', m.period)}  ${String((t / 60) | 0).padStart(2, '0')}:${String((t | 0) % 60).padStart(2, '0')}`;
  $('shotclock').textContent = Math.ceil(Math.max(0, m.shotClockLeft));
  const me = m.human;
  if (me) {
    const st = $('stamina'); st.style.width = me.stamina * 100 + '%'; st.style.background = me.sprintLocked ? '#e5533d' : '#4de683';
    $('charge-wrap').style.visibility = me.charging ? 'visible' : 'hidden';
    $('charge').style.width = me.charge * 100 + '%';
    $('zone').style.display = m.cfg.timing ? 'block' : 'none';
  }
  const withBall = me && m.ball.owner === me;
  const A = $('btnA'), B = $('btnB');
  A.textContent = L(withBall ? 'btn.shoot' : 'btn.defend'); A.dataset.mode = withBall ? 'shoot' : 'defend';
  B.textContent = L(withBall ? 'btn.pass' : 'btn.switch'); B.dataset.mode = withBall ? 'pass' : 'switch';
  if (toastT > 0) { toastT -= dt; $('toast').style.opacity = Math.min(1, toastT * 2); }
  if (timingT > 0) { timingT -= dt; if (timingT <= 0) $('timing').textContent = ''; }
  $('info').textContent = `${L('hud.prototype')} · ${fpsAvg.toFixed(0)} fps`;
  $('rotate').classList.toggle('hidden', innerWidth >= innerHeight);
}

let lastW = 0, lastH = 0;
function resize() {
  const w = innerWidth, h = innerHeight; if (w === lastW && h === lastH) return;
  lastW = w; lastH = h; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ boot
(async () => {
  await Promise.all([loadLang('en'), loadLang(lang)]);
  renderMenu();
  setupInput();
  $('play').onclick = () => { startMatch(); const el = document.documentElement; if (el.requestFullscreen && matchMedia('(pointer: coarse)').matches) el.requestFullscreen().catch(() => {}); };
  $('again').onclick = () => { match = null; for (const a of actors) scene.remove(a.g); actors = []; $('end').classList.add('hidden'); $('hud').classList.add('hidden'); $('menu').classList.remove('hidden'); renderMenu(); };
  $('tactic').onclick = (e) => { e.stopPropagation(); if (!match || !match.human) return; tacticIdx = (tacticIdx + 1) % TACTICS.length; match.setTactic(match.human.team, TACTICS[tacticIdx]); refreshTactic(); };
  requestAnimationFrame(frame);
})();
