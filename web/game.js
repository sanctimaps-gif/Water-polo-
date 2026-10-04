// WATER POLO 26 MOBILE — web build: match presentation (Three.js) + touch controls + HUD over the
// deterministic JS simulation. Rendering modules live in web/render/.
import * as THREE from './vendor/three.module.min.js';
import { Match, HOME, AWAY, Ev, TACTICS } from './sim.js';
import { PRESETS, TIERS, detectTier, FpsGovernor } from './render/quality.js';
import { Water } from './render/water.js';
import { Athlete } from './render/athlete.js';
import { Arena } from './render/arena.js';
import { Splashes } from './render/vfx.js';
import { MatchAudio } from './render/audio.js';

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

// ------------------------------------------------------------------ options (persisted per device)
const DEFAULT_OPTS = { team: 0, difficulty: 1, assist: 'STANDARD', minutes: 2, timing: true, graphics: 'AUTO', camera: 'STANDARD', replays: true, ambience: 'EVENT', sound: true };
let opts = { ...DEFAULT_OPTS };
try { Object.assign(opts, JSON.parse(localStorage.getItem('wp26.opts') || '{}')); } catch { /* private mode */ }
const saveOpts = () => { try { localStorage.setItem('wp26.opts', JSON.stringify(opts)); } catch { /* ignore */ } };
const DIFF = [0.75, 1, 1.15], DIFF_KEYS = ['difficulty.easy', 'difficulty.normal', 'difficulty.hard'];
const ASSISTS = ['ASSISTED', 'STANDARD', 'PRO'];
const MINUTES = [1, 2, 4, 8];
const GRAPHICS = ['AUTO', ...TIERS];
const CAMERAS = ['STANDARD', 'DYNAMIC', 'TACTICAL'];
const AMBIENCES = ['EVENT', 'DAY', 'EVENING', 'NIGHT'];
const TACTIC_KEYS = { BALANCED: 'tactic.balanced', FAST: 'tactic.fast', OFFENSIVE: 'tactic.offensive', DEFENSIVE: 'tactic.defensive', PRESSURE: 'tactic.pressure', CENTER: 'tactic.center', COUNTER: 'tactic.counter' };
const cycle = (list, v) => list[(list.indexOf(v) + 1) % list.length];

const $ = (id) => document.getElementById(id);

function renderMenu() {
  const home = HOME(), away = AWAY();
  const rows = [
    ['menu.team', (opts.team === 0 ? home : away).name, () => (opts.team = 1 - opts.team)],
    ['menu.difficulty', L(DIFF_KEYS[opts.difficulty]), () => (opts.difficulty = (opts.difficulty + 1) % 3)],
    ['menu.assist', L('assist.' + opts.assist.toLowerCase()), () => (opts.assist = cycle(ASSISTS, opts.assist))],
    ['menu.duration', L('menu.minutes', opts.minutes), () => (opts.minutes = cycle(MINUTES, opts.minutes))],
    ['menu.graphics', opts.graphics === 'AUTO' ? `${L('graphics.auto')} (${autoTier})` : opts.graphics, () => { opts.graphics = cycle(GRAPHICS, opts.graphics); applyQuality(opts.graphics === 'AUTO' ? autoTier : opts.graphics); }],
    ['menu.camera', L('cam.' + opts.camera.toLowerCase()), () => (opts.camera = cycle(CAMERAS, opts.camera))],
    ['menu.ambience', L('amb.' + opts.ambience.toLowerCase()), () => { opts.ambience = cycle(AMBIENCES, opts.ambience); arena.setAmbience(opts.ambience); }],
    ['menu.replays', L(opts.replays ? 'value.on' : 'value.off'), () => (opts.replays = !opts.replays)],
    ['menu.timing', L(opts.timing ? 'value.on' : 'value.off'), () => (opts.timing = !opts.timing)],
    ['menu.language', L('lang.name'), async () => { lang = cycle(LANGS, lang); await loadLang(lang); }],
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
    row.querySelector('button').onclick = async () => { await fn(); saveOpts(); renderMenu(); };
    box.appendChild(row);
  }
}

// ------------------------------------------------------------------ renderer + world
const detected = detectTier();
const autoTier = detected.tier;
let tier = opts.graphics === 'AUTO' ? autoTier : opts.graphics;
let preset = PRESETS[tier];
const renderer = new THREE.WebGLRenderer({ antialias: tier === 'HIGH' || tier === 'ULTRA', powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('view').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 160);
const water = new Water(scene, preset);
const arena = new Arena(scene, renderer, preset, opts.ambience);
const vfx = new Splashes(scene, water, preset.particles);
const audio = new MatchAudio();
audio.setEnabled(opts.sound);
const governor = new FpsGovernor();

function applyQuality(t) {
  tier = t; preset = PRESETS[t];
  renderer.setPixelRatio(Math.min(devicePixelRatio, preset.pixelRatio));
  if (renderer.shadowMap.enabled !== preset.shadows) {
    renderer.shadowMap.enabled = preset.shadows; arena.key.castShadow = preset.shadows;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
  }
  water.setQuality(preset);
  lastW = 0; // force a resize pass (pixel ratio)
}

// ------------------------------------------------------------------ ball (detailed: grooved rubber, grip texture)
function ballTextures() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#ffd21a'); grd.addColorStop(1, '#f2b705');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,80,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); } // grip
  g.strokeStyle = '#0d2a6b'; g.lineWidth = 9;
  for (let k = 0; k < 3; k++) {             // curved grooves (panel lines)
    g.beginPath();
    for (let x = 0; x <= 512; x += 4) { const y = 128 + Math.sin((x / 512) * Math.PI * 4 + k * 2.1) * 70 * (k === 1 ? -1 : 1); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const b = document.createElement('canvas'); b.width = 512; b.height = 256; const bg = b.getContext('2d');
  bg.drawImage(c, 0, 0); const id = bg.getImageData(0, 0, 512, 256);
  for (let i = 0; i < id.data.length; i += 4) { const v = id.data[i + 2] < 120 ? 40 : 200 + Math.random() * 30; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; }
  bg.putImageData(id, 0, 0);
  return { map, bump: new THREE.CanvasTexture(b) };
}
const bt = ballTextures();
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 20), new THREE.MeshStandardMaterial({ map: bt.map, bumpMap: bt.bump, bumpScale: 0.8, roughness: 0.32, envMapIntensity: 1.3 }));
ballMesh.castShadow = true; scene.add(ballMesh);
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x021c2c, transparent: true, opacity: 0.45, depthWrite: false }));
ballShadow.renderOrder = 4; scene.add(ballShadow);

// Markers: controlled player (ring + arrow), pass target.
const ringGeo = new THREE.RingGeometry(0.45, 0.58, 32).rotateX(-Math.PI / 2);
const selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd91a, transparent: true, opacity: 0.9, depthWrite: false }));
selRing.scale.setScalar(1.35); selRing.renderOrder = 5; scene.add(selRing);
const selArrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd91a, depthTest: false }));
selArrow.renderOrder = 10; scene.add(selArrow);
const passRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x4dff73, transparent: true, opacity: 0.8, depthWrite: false }));
passRing.renderOrder = 5; scene.add(passRing);

// Menu hero: one athlete treading water in front of the camera while the quick-match screen is shown.
let hero = null;
function buildHero() {
  if (hero) scene.remove(hero.root);
  hero = new Athlete({ teamColor: 0x1e5bd8, capColor: 0x1e5bd8, trimColor: 0xffffff, number: 7, role: 'CENTER', isGK: false, seed: 7, preset });
  hero.root.scale.multiplyScalar(1); scene.add(hero.root);
}

// ------------------------------------------------------------------ input
const input = { stick: { x: 0, y: 0, active: false }, A: btnState(), B: btnState(), S: btnState(), pan: 0, dbl: false, keys: new Set() };
function btnState() { return { held: false, press: false, release: false, down: 0, dur: 0, sx: 0, sy: 0, swipe: { x: 0, y: 0 } }; }

// Unified contacts: every finger (touch) or mouse button is routed to a control by WHERE it starts,
// using geometry (generous circles around the buttons) rather than the DOM target. This works the same
// on iOS Safari, Android Chrome and desktop, and is immune to overlays stealing the event.
const contacts = new Map(); // id -> { region, ox, oy, lx, ly }
const STICK_R = 70;
function hudActive() { return match && !match.finished && !$('hud').classList.contains('hidden') && !isPortrait(); }
function regionAt(x, y) {
  for (const id of ['btnA', 'btnB', 'btnS']) {
    const r = $(id).getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (Math.hypot(x - cx, y - cy) <= (r.width / 2) * 1.25) return id;
  }
  for (const id of ['tactic', 'camBtn', 'soundBtn']) {
    const t = $(id).getBoundingClientRect();
    if (x >= t.left - 6 && x <= t.right + 6 && y >= t.top - 6 && y <= t.bottom + 6) return id;
  }
  return x < innerWidth * 0.45 ? 'stick' : 'right';
}
const BTN = { btnA: () => input.A, btnB: () => input.B, btnS: () => input.S };
function contactStart(id, x, y) {
  if (replay) { endReplay(); return; }      // any touch skips the replay
  const region = regionAt(x, y);
  contacts.set(id, { region, ox: x, oy: y, lx: x, ly: y, moved: 0 });
  if (region === 'stick') {
    const zone = $('stick-zone').getBoundingClientRect(), base = $('stick');
    base.style.left = x - zone.left + 'px'; base.style.top = y - zone.top + 'px'; base.classList.add('on');
    input.stick.active = true;
  } else if (BTN[region]) {
    const st = BTN[region]();
    st.held = true; st.press = true; st.down = performance.now(); st.sx = x; st.sy = y; $(region).classList.add('down');
    if (navigator.vibrate) navigator.vibrate(8);
  }
}
function contactMove(id, x, y) {
  const c = contacts.get(id); if (!c) return;
  if (c.region === 'stick') {
    let dx = x - c.ox, dy = y - c.oy; const l = Math.hypot(dx, dy);
    if (l > STICK_R) { dx *= STICK_R / l; dy *= STICK_R / l; }
    $('knob').style.transform = `translate(${dx}px, ${dy}px)`;
    input.stick.x = dx / STICK_R; input.stick.y = -dy / STICK_R;
    $('stick').classList.toggle('sprint', Math.hypot(input.stick.x, input.stick.y) > 0.92);
  } else if (c.region === 'right') {
    input.pan += x - c.lx;
  }
  c.moved += Math.abs(x - c.lx) + Math.abs(y - c.ly); c.lx = x; c.ly = y;
}
let lastRightTap = 0;
function contactEnd(id) {
  const c = contacts.get(id); if (!c) return; contacts.delete(id);
  if (c.region === 'stick') {
    input.stick = { x: 0, y: 0, active: false }; $('knob').style.transform = ''; $('stick').classList.remove('on', 'sprint');
  } else if (BTN[c.region]) {
    const st = BTN[c.region]();
    st.held = false; st.release = true; st.dur = (performance.now() - st.down) / 1000; st.swipe = { x: c.lx - c.ox, y: c.ly - c.oy };
    $(c.region).classList.remove('down');
  } else if (c.region === 'tactic') {
    cycleTactic();
  } else if (c.region === 'camBtn') {
    opts.camera = cycle(CAMERAS, opts.camera); saveOpts(); refreshChips();
  } else if (c.region === 'soundBtn') {
    opts.sound = !opts.sound; audio.setEnabled(opts.sound); saveOpts(); refreshChips();
  } else if (c.region === 'right' && c.moved < 12) {
    const now = performance.now(); if (now - lastRightTap < 320) { input.dbl = true; lastRightTap = 0; } else lastRightTap = now;
  }
}

function setupInput() {
  const opts = { passive: false };
  const onTouch = (fn) => (e) => {
    if (!hudActive()) return;            // menus keep normal browser behaviour
    e.preventDefault();                  // no scroll, zoom, magnifier, callout or emulated mouse events
    for (const t of e.changedTouches) fn(t.identifier, t.clientX, t.clientY);
  };
  document.addEventListener('touchstart', onTouch(contactStart), opts);
  document.addEventListener('touchmove', onTouch(contactMove), opts);
  document.addEventListener('touchend', onTouch((id) => contactEnd(id)), opts);
  document.addEventListener('touchcancel', onTouch((id) => contactEnd(id)), opts);
  // Mouse (desktop): pointer events, mouse only so touches are never handled twice.
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && hudActive()) contactStart('m', e.clientX, e.clientY); });
  document.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') contactMove('m', e.clientX, e.clientY); });
  document.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') contactEnd('m'); });
  // Safety: losing focus (notification, app switch) releases every control.
  const releaseAll = () => { for (const id of [...contacts.keys()]) contactEnd(id); };
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', releaseAll);

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
  const cmd = { move: screenToWorld(sx, sy), sprint: input.S.held || Math.hypot(sx, sy) > 0.92 || k.has('ShiftLeft') || k.has('ShiftRight') };
  input.S.press = input.S.release = false;
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

// ------------------------------------------------------------------ actors
let athletes = [];
const capColorFor = (m, p) => (p.isGK ? 0xd81a1f : p.team === 0 ? m.teams[0].def.color : 0xf2f4f7);
const trimFor = (m, p) => (p.team === 0 ? 0xffffff : m.teams[1].def.color);
function buildActors(m) {
  for (const a of athletes) scene.remove(a.root);
  athletes = m.players.map((p) => {
    const a = new Athlete({ teamColor: m.teams[p.team].def.color, capColor: capColorFor(m, p), trimColor: trimFor(m, p), number: p.number,
      role: p.role, isGK: p.isGK, seed: p.id * 31 + p.team * 977 + 5, preset });
    a.onStroke = (x, z, power) => { vfx.stroke(x, z, power); };
    scene.add(a.root);
    return a;
  });
  if (hero) hero.root.visible = false;
}

// ------------------------------------------------------------------ view state (live or replay)
// One snapshot per simulation tick, kept for the replay system (6 s ring buffer).
const PF = 12, REPLAY_TICKS = 300;
const tape = [];
function record(m, events) {
  const players = new Float32Array(m.players.length * PF);
  m.players.forEach((p, i) => {
    players.set([p.pos.x, p.pos.z, p.facing.x, p.facing.z, p.vel.x, p.vel.z, p.charge, p.charging ? 1 : 0, p.block > 0 ? 1 : 0, p.sprinting ? 1 : 0, p.stamina, p.human ? 1 : 0], i * PF);
  });
  const b = m.ball;
  tape.push({ players, ball: [b.pos.x, b.pos.y, b.pos.z], owner: b.owner ? b.owner.id : -1, receiver: b.state === 'PASSED' && b.receiver ? b.receiver.id : -1, events });
  if (tape.length > REPLAY_TICKS) tape.shift();
}
const view = { players: [], ball: new THREE.Vector3(), owner: -1, receiver: -1 };
function buildView(a, b, t) {
  view.players.length = 0;
  for (let i = 0; i < athletes.length; i++) {
    const o = i * PF, A = a.players, B = b.players;
    const lerp = (k) => A[o + k] + (B[o + k] - A[o + k]) * t;
    view.players.push({ x: lerp(0), z: lerp(1), fx: B[o + 2], fz: B[o + 3], vx: B[o + 4], vz: B[o + 5], charge: B[o + 6], charging: B[o + 7] > 0,
      block: B[o + 8], sprint: B[o + 9] > 0, stamina: B[o + 10], human: B[o + 11] > 0 });
  }
  const far = Math.hypot(b.ball[0] - a.ball[0], b.ball[2] - a.ball[2]) > 3;
  view.ball.set(far ? b.ball[0] : a.ball[0] + (b.ball[0] - a.ball[0]) * t, far ? b.ball[1] : a.ball[1] + (b.ball[1] - a.ball[1]) * t, far ? b.ball[2] : a.ball[2] + (b.ball[2] - a.ball[2]) * t);
  view.owner = b.owner; view.receiver = b.receiver;
  return view;
}

// ------------------------------------------------------------------ match lifecycle
let match = null, acc = 0, userPan = 0;
// Diagnostics hook (read-only): window.__wp26() returns the controlled player's state.
window.__wp26log = [];
window.__wp26match = () => match; // test hook
window.__wp26 = () => match && match.human ? { name: match.human.name, x: +match.human.pos.x.toFixed(2), z: +match.human.pos.z.toFixed(2),
  hasBall: match.ball.owner === match.human, cmd: match.humanCmd, phase: match.phase, time: +match.time.toFixed(2), tier, replaying: !!replay } : null;
let toastT = 0, timingT = 0, tacticIdx = 0;
const camState = { focus: new THREE.Vector3(), goalT: 0, goalPoint: new THREE.Vector3(), goalSide: 1, shotT: 0, shotGoalX: 0 };
let replay = null, pendingReplay = null;

function startMatch() {
  const cfg = { seed: (Math.random() * 1e9) | 0, humanTeam: opts.team, cpu: DIFF[opts.difficulty], assist: opts.assist, periodDuration: opts.minutes * 60, timing: opts.timing };
  match = new Match(cfg, HOME(), AWAY());
  match.start();
  tape.length = 0; record(match, []); record(match, []);
  buildActors(match);
  tacticIdx = 0; replay = null; pendingReplay = null; camState.goalT = 0;
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('home-name').textContent = match.teams[0].def.short; $('away-name').textContent = match.teams[1].def.short;
  $('home-chip').style.background = hex(match.teams[0].def.color); $('away-chip').style.background = hex(match.teams[1].def.color);
  refreshTactic(); refreshChips();
  lockLandscape();
  audio.start(); audio.whistle(true);
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// ------------------------------------------------------------------ event reactions
/** Visual + audio reactions shared by live play and replays. */
function react(e) {
  const a = e.player >= 0 ? athletes[e.player] : null;
  switch (e.type) {
    case Ev.PASS: if (a) a.playThrow('pass'); vfx.burst(e.pos.x, e.pos.z, 0.35); audio.ballHit(0.5); break;
    case Ev.SHOT:
      if (a) a.playThrow('shot'); vfx.burst(e.pos.x, e.pos.z, 0.9); audio.ballHit(1.2);
      if (e.gk >= 0 && athletes[e.gk]) setTimeout(() => athletes[e.gk] && athletes[e.gk].playDive(e.diveDir), 160);
      arena.cheer(e.pos.x < -7 ? 0 : e.pos.x > 7 ? 2 : 1, 0.35);
      break;
    case Ev.SAVE: vfx.burst(e.pos.x, e.pos.z, 1.6); audio.splash(1.4); audio.ballHit(1); arena.cheer(-1, 0.6); break;
    case Ev.BLOCK: vfx.burst(e.pos.x, e.pos.z, 0.8); audio.ballHit(0.8); break;
    case Ev.FRAME: vfx.burst(e.pos.x, e.pos.z, 0.6); audio.post(); arena.cheer(-1, 0.5); break;
    case Ev.INTERCEPT: case Ev.STEAL: vfx.burst(e.pos.x, e.pos.z, 0.5); audio.splash(0.5); break;
    case Ev.GOAL: {
      arena.netHit(e.pos.x, e.pos.z, e.pos.y, 1.6); vfx.burst(e.pos.x, e.pos.z, 2.6); audio.netHit(); audio.roar(1.2);
      arena.cheer(-1, 1.5);
      if (a) a.playCelebrate(e.player % 2 ? 'splash' : 'arms');
      break;
    }
  }
}

function onEvent(e) {
  if (window.__wp26log.length < 500) window.__wp26log.push(e.type + ':' + e.team);
  const m = match, human = m.human ? m.human.team : -1;
  // Enrich shots with the defending keeper's dive side (stored for replays too).
  if (e.type === Ev.SHOT) {
    const gk = m.teams[1 - e.team].gk, cr = m.predictCrossing(gk.pos.x);
    e.gk = gk.id; e.diveDir = 1;
    if (cr) { const right = { x: gk.facing.z, z: -gk.facing.x }; e.diveDir = (cr.z - gk.pos.z) * right.z + 0 * right.x >= 0 ? 1 : -1; }
    camState.shotT = 1.2; camState.shotGoalX = m.targetGoal(e.team).x;
  }
  react(e);
  const toastMap = { [Ev.SAVE]: 'hud.save', [Ev.BLOCK]: 'hud.blocked', [Ev.FRAME]: 'hud.frame', [Ev.INTERCEPT]: 'hud.intercepted', [Ev.STEAL]: 'hud.steal', [Ev.FOUL]: 'hud.foul', [Ev.OUT]: 'hud.out', [Ev.SHOT_CLOCK]: 'hud.shotclock_violation', [Ev.SWIM_OFF]: 'hud.swimoff' };
  if (toastMap[e.type]) toast(L(toastMap[e.type]), 1.1);
  if ([Ev.FOUL, Ev.OUT, Ev.SHOT_CLOCK].includes(e.type)) audio.whistle(false);
  if (e.type === Ev.PERIOD_START) audio.whistle(true);
  if (e.type === Ev.GOAL) {
    toast(L('hud.goal'), 2.5);
    camState.goalT = 1.5; camState.goalPoint.set(e.pos.x, 0, e.pos.z); camState.goalSide = Math.sign(e.pos.x) || 1;
    if (opts.replays) pendingReplay = { at: 1.5 };
    // Team-mates close to the scorer join the celebration.
    const scorer = e.player >= 0 ? m.players[e.player] : null;
    if (scorer) for (const p of m.teams[scorer.team].field) if (p !== scorer && Math.hypot(p.pos.x - scorer.pos.x, p.pos.z - scorer.pos.z) < 5) athletes[p.id].playCelebrate('arms');
    if (e.team === human && navigator.vibrate) navigator.vibrate([60, 40, 120]);
  }
  if (e.type === Ev.PERIOD_END) { toast(L('hud.period_end', e.value), 2.5); audio.whistle(true); arena.cheer(-1, 0.8); }
  if (e.type === Ev.RESTART || e.type === Ev.PERIOD_START) camState.goalT = 0;
  if (e.type === Ev.SHOT && e.team === human && e.timing && e.timing !== 'NONE') {
    const el = $('timing'); el.textContent = L('hud.timing.' + e.timing.toLowerCase()); el.className = 't-' + e.timing.toLowerCase(); timingT = 1.2;
  }
  if (e.type === Ev.END) { audio.whistle(true); audio.roar(1); arena.cheer(-1, 1.2); showEnd(e.team, human); }
}
function toast(t, s) { $('toast').textContent = t; toastT = s; }

// ------------------------------------------------------------------ replay
function startReplay() {
  if (tape.length < 60) return;
  const start = Math.max(0, tape.length - 50 * 5);
  replay = { frames: tape.slice(start), t: 0, speed: 0.55, angle: 0 };
  document.body.classList.add('replaying');
  $('replay').classList.remove('hidden'); $('replay-title').textContent = L('hud.replay'); $('replay-skip').textContent = L('hud.skip');
}
function endReplay() {
  replay = null;
  document.body.classList.remove('replaying');
  $('replay').classList.add('hidden');
  camState.goalT = 0;
}

// ------------------------------------------------------------------ camera director
const tmp = new THREE.Vector3();
function updateCamera(dt, v) {
  const m = match, c = camState;
  const ball = ballMesh.position;
  let pos, look, fov;
  if (replay) {
    // Two angles: behind the goal (low), then side-on at water level.
    const u = replay.t / (replay.frames.length - 1), side = c.goalSide;
    if (u < 0.55) { pos = tmp.set(side * 18.5, 2.4, ball.z * 0.4 + 1.5); look = ball.clone(); fov = 34; }
    else { pos = tmp.set(ball.x - side * 4, 0.9, -7.5); look = ball.clone(); fov = 40; }
    camera.position.lerp(pos, 1 - Math.exp(-dt * 6)); camera.lookAt(look); setFov(fov, dt, 6);
    return;
  }
  const target = ball.clone();
  if (m.human) target.lerp(athletes[m.human.id].root.position, 0.25);
  const team = m.possessionTeam;
  const lead = opts.camera === 'DYNAMIC' ? 3 : 2;
  if (team >= 0) target.x += (team === 0 ? 1 : -1) * lead;
  if (c.shotT > 0) { c.shotT -= dt; target.x += (c.shotGoalX - target.x) * 0.35; }   // follow the shot toward goal
  const near = Math.min(1, Math.max(0, (Math.abs(ball.x) - 6) / 5));
  let height, back, sideX = 0;
  if (opts.camera === 'TACTICAL') { height = 16; back = 10 + 9; fov = 50; target.x *= 0.7; }
  else if (opts.camera === 'DYNAMIC') { height = 6.2 - 1 * near; back = 10 + 4.8 - 1 * near; fov = 52 - 4 * near; sideX = team >= 0 ? -(team === 0 ? 1 : -1) * 2.5 : 0; }
  else { height = 9.5 - 1.5 * near; back = 10 + 7.5 - 1.5 * near; fov = 48 - 6 * near; }
  if (c.shotT > 0) fov -= 4;
  target.x = Math.max(-12.5 + 6, Math.min(12.5 - 6, target.x + userPan));
  target.z = Math.max(-2.5, Math.min(2.5, target.z * (opts.camera === 'DYNAMIC' ? 0.55 : 0.35))); target.y = 0;
  if (c.goalT > 0) {
    // Goal camera: close, low, 3/4 view of the net and the celebration.
    c.goalT -= dt; target.set(c.goalPoint.x - c.goalSide * 2.5, 0, c.goalPoint.z * 0.5);
    height = 3.2; back = 7.5; fov = 40; sideX = -c.goalSide * 3;
  }
  c.focus.lerp(target, 1 - Math.exp(-dt / 0.25));
  pos = tmp.set(c.focus.x + sideX, height, c.focus.z - back);
  camera.position.lerp(pos, 1 - Math.exp(-dt * 4));
  camera.lookAt(c.focus.x, 0.5, c.focus.z);
  setFov(fov, dt, 3);
  userPan += (0 - userPan) * Math.min(1, dt * 0.8);
}
function setFov(fov, dt, rate) {
  // Landscape screens narrower than 16:9 (4:3 tablets): keep the same horizontal view of the pool.
  const aspect = innerWidth / innerHeight, ref = 16 / 9;
  if (aspect < ref) fov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * ref / aspect) * 180 / Math.PI;
  camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * rate)); camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ per-frame presentation
let prevBallY = 1, prevBallPos = new THREE.Vector3(), dripT = 0;
const wakeList = [];
function updateWorld(dt, v) {
  // Athletes
  for (let i = 0; i < athletes.length; i++) {
    const s = v.players[i];
    s.hasBall = v.owner === i; s.receive = v.receiver === i && Math.hypot(v.ball.x - s.x, v.ball.z - s.z) < 2.8; s.ball = v.ball;
    athletes[i].update(dt, s);
  }
  // Ball: in the hand when held, simulated position otherwise.
  if (v.owner >= 0) athletes[v.owner].handWorld(ballMesh.position); else ballMesh.position.copy(v.ball);
  const bvx = (ballMesh.position.x - prevBallPos.x) / Math.max(dt, 1e-3), bvz = (ballMesh.position.z - prevBallPos.z) / Math.max(dt, 1e-3);
  ballMesh.rotation.x += bvz * dt * 3.5; ballMesh.rotation.z -= bvx * dt * 3.5;
  // Ball meets the water: splash scaled by its speed.
  if (v.owner < 0 && prevBallY > 0.2 && ballMesh.position.y <= 0.16) {
    const sp = Math.hypot(bvx, bvz); vfx.burst(ballMesh.position.x, ballMesh.position.z, Math.min(1.4, 0.2 + sp / 10)); audio.splash(Math.min(1, sp / 10));
  }
  prevBallY = ballMesh.position.y; prevBallPos.copy(ballMesh.position);
  // Drops falling from the ball held up.
  dripT -= dt; if (v.owner >= 0 && dripT <= 0) { dripT = 0.18; vfx.drip(ballMesh.position.x, ballMesh.position.y - 0.08, ballMesh.position.z); }
  ballShadow.position.set(ballMesh.position.x, 0.03, ballMesh.position.z);
  ballShadow.material.opacity = v.owner >= 0 ? 0 : Math.max(0, 0.45 - ballMesh.position.y * 0.12);
  // Wakes in the water shader.
  wakeList.length = 0;
  for (const s of v.players) wakeList.push({ x: s.x, z: s.z, vx: s.vx, vz: s.vz });
  water.setWakes(wakeList);
  // Markers
  const hi = v.players.findIndex((s) => s.human);
  selRing.visible = selArrow.visible = hi >= 0 && !replay;
  if (hi >= 0) {
    const r = athletes[hi].root.position; selRing.position.set(r.x, 0.04, r.z);
    selArrow.position.set(r.x, 1.75 + Math.sin(performance.now() / 180) * 0.1, r.z); selArrow.rotation.y += dt * 3;
  }
  passRing.visible = false;
  const me = match.human;
  if (!replay && me && match.ball.owner === me) {
    const target = match.chooseTarget(me, currentMove, match.cfg.assist, me.prof.risk, match.teams[me.team].tp.center);
    if (target) { const r = athletes[target.id].root.position; passRing.position.set(r.x, 0.04, r.z); passRing.visible = true; }
  }
  arena.focusShadows(camState.focus.x, camState.focus.z);
}

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

function cycleTactic() { if (!match || !match.human) return; tacticIdx = (tacticIdx + 1) % TACTICS.length; match.setTactic(match.human.team, TACTICS[tacticIdx]); refreshTactic(); }
function refreshTactic() { if (match) $('tactic').textContent = `${L('btn.tactic')}: ${L(TACTIC_KEYS[TACTICS[tacticIdx]])}`; }
function refreshChips() { $('camBtn').textContent = L('cam.' + opts.camera.toLowerCase()); $('soundBtn').textContent = opts.sound ? '🔊' : '🔇'; }

// ------------------------------------------------------------------ LANDSCAPE ONLY
const isPortrait = () => innerHeight > innerWidth;
function lockLandscape() {
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch {}
}
function updateOrientationGate() {
  const portrait = isPortrait();
  $('rotate').classList.toggle('hidden', !portrait);
  $('rotate-title').textContent = L('hud.rotate');
  $('rotate-hint').textContent = L('hud.rotate_hint');
  return portrait;
}

// ------------------------------------------------------------------ frame loop
let last = performance.now(), fpsAvg = 60, sinceRender = 0, time = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (updateOrientationGate()) { acc = 0; return; }
  // 30 fps tiers: render every other display frame (battery / heat).
  sinceRender += dt;
  if (preset.targetFps === 30 && sinceRender < 1 / 32) return;
  const fdt = sinceRender; sinceRender = 0;
  fpsAvg += (1 / Math.max(fdt, 1e-3) - fpsAvg) * 0.05;
  if (opts.graphics === 'AUTO' && governor.sample(fdt, preset.targetFps) && tier !== 'LOW') applyQuality(TIERS[TIERS.indexOf(tier) - 1]);
  resize();
  time += fdt;
  water.update(time); arena.update(fdt, time); vfx.update(fdt);

  if (match) {
    let v;
    if (replay) {
      replay.t += fdt * 50 * replay.speed;
      const i = Math.min(replay.frames.length - 2, Math.floor(replay.t));
      if (Math.floor(replay.t - fdt * 50 * replay.speed) < i) for (const e of replay.frames[i].events) react(e);   // re-play visual reactions
      v = buildView(replay.frames[i], replay.frames[i + 1], replay.t - i);
      if (replay.t >= replay.frames.length - 1) endReplay();
    } else {
      if (!match.finished) {
        pollInput(match);
        if (pendingReplay) { pendingReplay.at -= fdt; if (pendingReplay.at <= 0) { pendingReplay = null; startReplay(); } }
        if (!replay) {
          acc += fdt; let steps = 0;
          while (acc >= match.cfg.dt && steps < 5) {
            match.step(); const evs = match.drain(); for (const e of evs) onEvent(e); record(match, evs);
            acc -= match.cfg.dt; steps++;
          }
          if (steps === 5) acc = 0;
        }
      }
      v = buildView(tape[tape.length - 2], tape[tape.length - 1], Math.min(1, acc / match.cfg.dt));
    }
    updateWorld(fdt, v);
    updateCamera(fdt, v);
    updateHud(fdt);
    arena.drawScreen({ home: match.teams[0].def.short, away: match.teams[1].def.short, hs: match.teams[0].score, as: match.teams[1].score,
      clock: `P${match.period}  ${String((Math.max(0, match.periodLeft) / 60) | 0).padStart(2, '0')}:${String(Math.max(0, match.periodLeft | 0) % 60).padStart(2, '0')}` });
    audio.setCrowd(Math.max(...arena.excite));
  } else if (showcase) {
    // Debug / presentation: athletes side by side in each animation state, slow orbit.
    showcase.forEach((a, i) => a.update(fdt, a.showcaseState(time)));
    const ang = time * 0.25;
    camera.position.set(Math.sin(ang) * 1.2, 0.9, -3.6 + Math.cos(ang) * 0.4); camera.lookAt(0, 0.35, 0); setFov(40, fdt, 10);
    ballMesh.position.set(0, -5, 0); selRing.visible = selArrow.visible = passRing.visible = false;
  } else {
    // Menu: the hero treads water in front of a slow orbit of the arena.
    if (!hero) buildHero();
    hero.root.visible = true;
    hero.update(fdt, { x: 0, z: -6, fx: Math.sin(time * 0.3) * 0.3, fz: -1, vx: 0, vz: 0, hasBall: true, charging: false, charge: 0, block: 0, stamina: 1, ball: new THREE.Vector3(0, 1, -12), receive: false });
    hero.handWorld(ballMesh.position);
    const ang = Math.sin(time * 0.15) * 0.5;
    camera.position.set(Math.sin(ang) * 3.2, 1.0, -6 - Math.cos(ang) * 3.2);
    camera.lookAt(0, 0.5, -6);
    setFov(42, fdt, 10);
    water.setWakes([{ x: 0, z: -6, vx: 0, vz: 0 }]);
    selRing.visible = selArrow.visible = passRing.visible = false; ballShadow.material.opacity = 0;
  }
  renderer.render(scene, camera);
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
  $('btnS').textContent = L('btn.sprint');
  A.textContent = L(withBall ? 'btn.shoot' : 'btn.defend'); A.dataset.mode = withBall ? 'shoot' : 'defend';
  B.textContent = L(withBall ? 'btn.pass' : 'btn.switch'); B.dataset.mode = withBall ? 'pass' : 'switch';
  if (toastT > 0) { toastT -= dt; $('toast').style.opacity = Math.min(1, toastT * 2); }
  if (timingT > 0) { timingT -= dt; if (timingT <= 0) $('timing').textContent = ''; }
  const info = new URLSearchParams(location.search).has('debug') ? ` · ${renderer.info.render.calls} dc · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tri` : '';
  $('info').textContent = `${L('hud.prototype')} · ${tier} · ${fpsAvg.toFixed(0)} fps${info}`;
}

let lastW = 0, lastH = 0;
function resize() {
  const w = innerWidth, h = innerHeight; if (w === lastW && h === lastH) return;
  lastW = w; lastH = h; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  vfx.setScale(h * Math.min(devicePixelRatio, preset.pixelRatio));
}

// ------------------------------------------------------------------ showcase (?showcase): close-up check of models & animations
let showcase = null;
function buildShowcase() {
  const states = ['tread', 'swim', 'hold', 'wind', 'gk', 'celebrate'];
  showcase = states.map((st, i) => {
    const a = new Athlete({ teamColor: i % 2 ? 0xd8321e : 0x1e5bd8, capColor: st === 'gk' ? 0xd81a1f : i % 2 ? 0xf2f4f7 : 0x1e5bd8, trimColor: 0xffffff,
      number: i + 2, role: ['CENTER', 'WINGER', 'FINISHER', 'PLAYMAKER', 'GOALKEEPER', 'DEFENDER'][i], isGK: st === 'gk', seed: 11 + i * 17, preset });
    const x = (i - 2.5) * 0.85;
    a.showcaseState = (t) => {
      if (st === 'celebrate' && a.celebrateT <= 0) a.playCelebrate('arms');
      return { x, z: 0, fx: 0, fz: -1, vx: st === 'swim' ? 0 : 0, vz: st === 'swim' ? -1.5 : 0, sprint: false, hasBall: st === 'hold', charging: st === 'wind',
        charge: (t * 0.6) % 1, block: 0, stamina: 1, ball: new THREE.Vector3(x, 1, -3), receive: false };
    };
    scene.add(a.root); return a;
  });
  $('menu').classList.add('hidden');
}

// ------------------------------------------------------------------ boot
(async () => {
  await Promise.all([loadLang('en'), loadLang(lang)]);
  applyQuality(tier);
  renderMenu();
  setupInput();
  $('play').onclick = async () => {
    // Fullscreen first: browsers only allow the orientation lock in fullscreen.
    const el = document.documentElement;
    if (el.requestFullscreen && matchMedia('(pointer: coarse)').matches) { try { await el.requestFullscreen(); } catch {} }
    lockLandscape();
    startMatch();
  };
  addEventListener('pointerdown', lockLandscape, { once: true });
  $('again').onclick = () => {
    match = null; endReplay();
    for (const a of athletes) scene.remove(a.root);
    athletes = [];
    $('end').classList.add('hidden'); $('hud').classList.add('hidden'); $('menu').classList.remove('hidden'); renderMenu();
  };
  $('tactic').onclick = (e) => { if (e.detail !== 0 || e.pointerType) return; cycleTactic(); };
  if (new URLSearchParams(location.search).has('showcase')) buildShowcase();
  requestAnimationFrame(frame);
})();
