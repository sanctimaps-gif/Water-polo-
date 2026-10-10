// WATER POLO 26 MOBILE — web build: match presentation (Three.js) + touch controls + HUD over the
// deterministic JS simulation. Rendering modules live in web/render/.
import * as THREE from './vendor/three.module.min.js';
import { Match, Ev, TACTICS, FORMATIONS, DRILLS } from './sim.js';
import { logoSvg } from './ui/art.js';
import { GameState, lookOf, POOLS, BALL_DESIGNS, overall, ROLE_ABBR, countryOf } from './state.js';
import { App } from './ui/app.js';
import { UI } from './ui/i18n.js';
import { PRESETS, TIERS, detectTier, FpsGovernor } from './render/quality.js';
import { Water, UW_STRENGTH } from './render/water.js';
import { Athlete, loadScanHead, loadScanBody, loadAnimations } from './render/athlete.js';
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
  let s = (UI[lang] && UI[lang][k]) || (tables[lang] && tables[lang][k]) || UI.en[k] || (tables.en && tables.en[k]) || k;
  a.forEach((v, i) => (s = s.replace(`{${i}}`, v)));
  return s;
};

// ------------------------------------------------------------------ options (persisted per device)
const DEFAULT_OPTS = { difficulty: 1, assist: 'STANDARD', minutes: 2, timing: true, autoSwitch: true, zoom: 5, radar: true, intro: true, graphics: 'AUTO', camera: 'ATTACK', replays: true, ambience: 'EVENT', sound: true };
let opts = { ...DEFAULT_OPTS };
try { Object.assign(opts, JSON.parse(localStorage.getItem('wp26.opts') || '{}')); } catch { /* private mode */ }
if (!opts.camV2) { opts.camera = 'ATTACK'; opts.camV2 = true; }   // new default camera (end-on, toward the attacked goal)
const saveOpts = () => { try { localStorage.setItem('wp26.opts', JSON.stringify(opts)); } catch { /* ignore */ } };
const DIFF = [0.75, 1, 1.15], DIFF_KEYS = ['difficulty.easy', 'difficulty.normal', 'difficulty.hard'];
const ASSISTS = ['ASSISTED', 'STANDARD', 'PRO'];
const MINUTES = [1, 2, 4, 8];
const GRAPHICS = ['AUTO', ...TIERS];
// Match cameras (Settings > Match, and the CAM chip in the match): attack (high, end-on, looking at the
// goal we attack, like console rugby / football games), broadcast, wide, close, dynamic side,
// top view, behind the controlled player, pool deck (low side).
const HUD_CAMS = ['STANDARD', 'ATTACK', 'WIDE', 'EYES'];   // HUD CAM chip: TV / MATCH / LARGE (all cameras in the settings)
const CAM_LABEL = { STANDARD: 'cam.tv', ATTACK: 'cam.match', WIDE: 'cam.large', EYES: 'cam.eyes' };
const CAMERAS = ['ATTACK', 'STANDARD', 'WIDE', 'CLOSE', 'DYNAMIC', 'TACTICAL', 'BEHIND', 'DECK', 'EYES', 'UNDER'];
const AMBIENCES = ['EVENT', 'DAY', 'EVENING', 'NIGHT'];
const TACTIC_KEYS = { BALANCED: 'tactic.balanced', FAST: 'tactic.fast', OFFENSIVE: 'tactic.offensive', DEFENSIVE: 'tactic.defensive', PRESSURE: 'tactic.pressure', CENTER: 'tactic.center', COUNTER: 'tactic.counter' };
const cycle = (list, v) => list[(list.indexOf(v) + 1) % list.length];

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ renderer + world
const detected = detectTier();
const autoTier = detected.tier;
let tier = opts.graphics === 'AUTO' ? autoTier : opts.graphics;
let preset = PRESETS[tier];
const renderer = new THREE.WebGLRenderer({ antialias: tier === 'HIGH' || tier === 'ULTRA', powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
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
function ballTextures(design = 'classic') {
  const [c0, c1, groove] = BALL_DESIGNS[design] || BALL_DESIGNS.classic;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, c0); grd.addColorStop(1, c1);
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,80,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); } // grip
  g.strokeStyle = groove; g.lineWidth = 9;
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
let ballDesign = 'classic';
// Light trajectory trail behind the ball in flight (additive line fading to black = transparent).
const TRAIL_N = 26;
const trail = { n: 0, pts: new Float32Array(TRAIL_N * 3), geo: new THREE.BufferGeometry() };
trail.geo.setAttribute('position', new THREE.BufferAttribute(trail.pts, 3));
{ const col = new Float32Array(TRAIL_N * 3); for (let i = 0; i < TRAIL_N; i++) { const k = 1 - i / (TRAIL_N - 1); col[i * 3] = k; col[i * 3 + 1] = k * 0.92; col[i * 3 + 2] = k * 0.6; }
  trail.geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
trail.line = new THREE.Line(trail.geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
trail.line.frustumCulled = false; trail.line.renderOrder = 6;
function updateTrail(flying, p) {
  if (!flying) { trail.n = Math.max(0, trail.n - 2); } else trail.n = Math.min(TRAIL_N, trail.n + 1);
  trail.pts.copyWithin(3, 0, (TRAIL_N - 1) * 3); trail.pts[0] = p.x; trail.pts[1] = p.y; trail.pts[2] = p.z;
  trail.geo.setDrawRange(0, trail.n); trail.geo.attributes.position.needsUpdate = true; trail.line.visible = trail.n > 1;
}
function setBall(design) {
  if (design === ballDesign || !BALL_DESIGNS[design]) return;
  const t = ballTextures(design), m = ballMesh.material; m.map.dispose(); m.bumpMap.dispose();
  m.map = t.map; m.bumpMap = t.bump; m.needsUpdate = true; ballDesign = design;
}
ballMesh.castShadow = true; scene.add(ballMesh);
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x021c2c, transparent: true, opacity: 0.45, depthWrite: false }));
ballShadow.renderOrder = 4; scene.add(ballShadow); scene.add(trail.line);

// Markers: controlled player (ring + arrow), pass target.
const ringGeo = new THREE.RingGeometry(0.45, 0.58, 32).rotateX(-Math.PI / 2);
const selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
selRing.scale.setScalar(1.35); selRing.renderOrder = 5; scene.add(selRing);
const selArrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd91a, depthTest: false }));
selArrow.renderOrder = 10; scene.add(selArrow);
const passRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x4dff73, transparent: true, opacity: 0.8, depthWrite: false }));
passRing.renderOrder = 5; scene.add(passRing);
// DÉFIS tutorial: target ring on the water.
const goalRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.85, depthWrite: false }));
goalRing.renderOrder = 5; goalRing.visible = false; scene.add(goalRing);

// ------------------------------------------------------------------ kits
// Club kits (home / away / goalkeeper) -> Athlete options. Water polo: one team in dark caps, the other in
// white / light caps; goalkeepers in red caps.
const lum = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
function kitOptions(kit, gk, isGK, user) {
  const shop = (k) => (user ? state.equippedColor(k) : null);   // shop cap / trim only on the user's club
  const cap = isGK ? gk.cap : shop('cap') ?? kit.cap, trim = shop('trim') ?? kit.suit2;
  return { teamColor: kit.suit, suit2: kit.suit2, suitPattern: kit.pattern, trimColor: trim, capColor: cap,
    capTrim: isGK ? gk.capTrim : kit.capTrim, numberColor: isGK ? gk.number : kit.number };
}
function matchKits(defA, defB, prefA = 'home') {
  const fall = (d) => d.kits || { home: { suit: d.color, suit2: 0xffffff, pattern: 'plain', cap: d.color, capTrim: 0xffffff, number: 0xffffff }, away: { suit: 0xffffff, suit2: d.color, pattern: 'plain', cap: 0xf4f6f8, capTrim: d.color, number: d.color }, goalkeeper: { cap: 0xd81a1f, capTrim: 0xffffff, number: 0xffffff } };
  const A = fall(defA), B = fall(defB);
  const ka = prefA === 'away' ? A.away : A.home, kb = lum(ka.cap) > 0.55 ? (lum(B.home.cap) <= 0.55 ? B.home : { ...B.home, cap: 0x1b2f5a, number: 0xffffff }) : B.away;
  return [{ kit: ka, gk: A.goalkeeper }, { kit: kb, gk: B.goalkeeper }];
}

// Menu hero: one athlete treading water in front of the camera while the quick-match screen is shown.
// The club editor uses it as a live 3D preview: draft kits (home / away / goalkeeper), ball, rotation.
let hero = null, heroYaw = 0, heroPreview = null;
function buildHero() {
  if (hero) scene.remove(hero.root);
  const c = heroPreview ? heroPreview.club : state.data.club, pl = heroPreview && heroPreview.player;
  const view = heroPreview ? heroPreview.view : 'home', gk = pl ? pl.role === 'GOALKEEPER' : view === 'gk';
  const kit = view === 'away' ? c.kits.away : c.kits.home;
  if (pl) {   // player sheet: the real 3D model of the player (same seed as in matches)
    const look = lookOf(pl);
    hero = new Athlete({ ...kitOptions(kit, c.kits.goalkeeper, gk, true), number: pl.number, role: pl.role, bodyRole: look.role, isGK: gk, seed: look.seed, preset });
  } else hero = new Athlete({ ...kitOptions(kit, c.kits.goalkeeper, gk, !heroPreview), number: gk ? 1 : 7, role: gk ? 'GOALKEEPER' : 'CENTER', isGK: gk, seed: 7, preset });
  scene.add(hero.root);
  setBall(c.ball || 'classic');
}

// ------------------------------------------------------------------ input
const input = { stick: { x: 0, y: 0, active: false }, A: btnState(), B: btnState(), S: btnState(), D: btnState(), pan: 0, dbl: false, keys: new Set() };
function btnState() { return { held: false, press: false, release: false, down: 0, dur: 0, sx: 0, sy: 0, swipe: { x: 0, y: 0 } }; }

// Unified contacts: every finger (touch) or mouse button is routed to a control by WHERE it starts,
// using geometry (generous circles around the buttons) rather than the DOM target. This works the same
// on iOS Safari, Android Chrome and desktop, and is immune to overlays stealing the event.
const contacts = new Map(); // id -> { region, ox, oy, lx, ly }
const STICK_R = 70;
function hudActive() { return match && !intro && !paused && !match.finished && !$('hud').classList.contains('hidden'); }
// Automatic landscape: phone held upright -> the page is turned 90° clockwise (html.fake-land, see style.css).
// Touches and element rectangles are converted from the screen to the game's landscape coordinates.
let fakeLand = false;
const LW = () => (fakeLand ? innerHeight : innerWidth), LH = () => (fakeLand ? innerWidth : innerHeight);
const toL = (x, y) => (fakeLand ? [y, innerWidth - x] : [x, y]);
function lrect(el) {
  const r = el.getBoundingClientRect(); if (!fakeLand) return r;
  const left = r.top, right = r.bottom, top = innerWidth - r.right, bottom = innerWidth - r.left;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}
window.wpToL = toL;
function regionAt(x, y) {
  for (const id of ['btnA', 'btnB', 'btnS', 'btnD']) {
    const r = lrect($(id)); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (Math.hypot(x - cx, y - cy) <= (r.width / 2) * 1.25) return id;
  }
  for (const id of ['tactic', 'camBtn', 'soundBtn', 'pauseBtn', 'skipBtn']) {
    if ($(id).classList.contains('hidden')) continue;
    const t = lrect($(id));
    if (x >= t.left - 6 && x <= t.right + 6 && y >= t.top - 6 && y <= t.bottom + 6) return id;
  }
  return x < LW() * 0.45 ? 'stick' : 'right';
}
const BTN = { btnA: () => input.A, btnB: () => input.B, btnS: () => input.S, btnD: () => input.D };
function contactStart(id, x, y) {
  if (replay) { endReplay(); return; }      // any touch skips the replay
  const region = regionAt(x, y);
  contacts.set(id, { region, ox: x, oy: y, lx: x, ly: y, moved: 0 });
  if (region === 'stick') {
    const zone = lrect($('stick-zone')), base = $('stick');
    base.style.left = x - zone.left + 'px'; base.style.top = y - zone.top + 'px'; base.classList.add('on');
    input.stick.active = true;
  } else if (BTN[region]) {
    const st = BTN[region]();
    st.held = true; st.press = true; st.down = performance.now(); st.sx = x; st.sy = y; $(region).classList.add('down'); haptic(region === 'btnA' ? 14 : 9);
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
    openTactics(false);
  } else if (c.region === 'camBtn') {
    opts.camera = cycle(HUD_CAMS, HUD_CAMS.includes(opts.camera) ? opts.camera : HUD_CAMS[HUD_CAMS.length - 1]); saveOpts(); refreshChips(); haptic(8);
  } else if (c.region === 'skipBtn') {
    skipPresentation();
  } else if (c.region === 'pauseBtn') {
    openPause();
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
    for (const t of e.changedTouches) fn(t.identifier, ...toL(t.clientX, t.clientY));
  };
  document.addEventListener('touchstart', onTouch(contactStart), opts);
  document.addEventListener('touchmove', onTouch(contactMove), opts);
  document.addEventListener('touchend', onTouch((id) => contactEnd(id)), opts);
  document.addEventListener('touchcancel', onTouch((id) => contactEnd(id)), opts);
  // Mouse (desktop): pointer events, mouse only so touches are never handled twice.
  document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && hudActive()) contactStart('m', ...toL(e.clientX, e.clientY)); });
  document.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') contactMove('m', ...toL(e.clientX, e.clientY)); });
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
  if (input.D.press || k.has('KeyE')) { input.D.press = false; if (hasBall) cmd.dodge = true; }
  input.D.release = false;
  currentMove = cmd.move;
  const A = input.A, B = input.B;
  if (A.press) { A.press = false; aCtx = hasBall; if (!hasBall) cmd.defend = true; }
  if (aCtx && hasBall) cmd.shootHeld = A.held;
  if (!hasBall && !aCtx && A.held) cmd.defendHeld = true;   // DÉFENSE held: automatic pressing
  if (A.release) {
    A.release = false;
    if (aCtx) {
      cmd.shootReleased = true;
      const sw = A.swipe, sl = Math.hypot(sw.x, sw.y);
      if (sl > 40) {
        // Swipe -> aim, in world space (works with every camera angle): lateral = across the goal, toward the goal = higher.
        const s = me.team === 0 ? 1 : -1, n = LH() * 0.25, w = screenToWorld(sw.x / n, -sw.y / n);
        cmd.hasAim = true; cmd.aimX = Math.max(-1.2, Math.min(1.2, -s * w.z)); cmd.aimY = Math.max(0, Math.min(1, 0.4 + w.x * s * 0.6));
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

// Pre-match screen: the best player of each team standing on the deck, full body, either side of the card.
let pmView = null;
function clearPrematch() { if (pmView) { for (const a of pmView.ath) scene.remove(a.root); for (const l of pmView.lights) scene.remove(l, l.target); pmView = null; } }
function buildPrematch(oppId, pref = 'home') {
  clearPrematch();
  const me = { ...state.clubInfo('user'), kits: state.data.club.kits }, opp = state.clubInfo(oppId), kits = matchKits(me, opp, pref);
  const best = (sq) => sq.filter((p) => p.role !== 'GOALKEEPER').sort((a, b) => overall(b) - overall(a))[0];
  const ath = [best(state.squad), best(state.opponentSquad(oppId))].map((p, i) => {
    const look = lookOf(p), K = kits[i];
    const a = new Athlete({ ...kitOptions(K.kit, K.gk, false, i === 0), number: p.number, role: p.role, bodyRole: look.role, isGK: false, seed: look.seed, preset });
    scene.add(a.root); return a;
  });
  // presentation lights (front key, cool rim from the stands)
  const key = new THREE.DirectionalLight(0xfff3e4, 2.4), rim = new THREE.DirectionalLight(0x9fd4ff, 1.6);
  key.position.set(1.5, 3.6, -5); key.target.position.set(0, 1.2, -11.6); rim.position.set(-1, 3, -15); rim.target.position.set(0, 1, -11.6);
  const lights = [key, rim]; for (const l of lights) scene.add(l, l.target);
  pmView = { ath, lights, key: oppId + '|' + pref };
  setBall(state.data.club.ball || 'classic');
}
function updatePrematchView(dt) {
  const Z = -11.6, X = [-2.9, 2.9];   // long side deck, stands behind; user on the left of the screen
  pmView.ath.forEach((a, i) => {
    a.update(dt, { x: X[i], z: Z, fx: i ? -0.15 : 0.15, fz: 1, vx: 0, vz: 0, hasBall: false, charging: false, charge: 0, block: 0, stamina: 1, ball: ballMesh.position, receive: false });
    a.overridePose('stand'); a.root.position.set(X[i], 0.3 + a.standHeight() + Math.sin(time * 1.6 + i) * 0.004, Z);
  });
  ballMesh.position.set(X[0] + 0.4, 0.3 + 0.11, Z + 0.45);
  const sw = Math.sin(time * 0.2) * 0.2;
  camera.position.set(sw, 1.32, -5.5); camera.lookAt(0, 1.2, Z); setFov(34, dt, 10);
}

// ------------------------------------------------------------------ actors
let athletes = [];
/** 3D athlete of a match player: appearance tied to the squad player (same face / body in the cards and every match); kit of the club. */
function makeAthlete(m, p) {
  const K = m.kits[p.team];
  const a = new Athlete({ ...kitOptions(K.kit, K.gk, p.isGK, p.team === 0 && m.teams[0].def.id === 'user'), number: p.number,
    role: p.role, bodyRole: p.look ? p.look.role : p.role, isGK: p.isGK, seed: p.look ? p.look.seed : p.id * 31 + p.team * 977 + 5, preset });
  a.onStroke = (x, z, power) => { vfx.stroke(x, z, power); };
  a.onDrip = (x, y, z) => { vfx.drip(x, y, z); };
  a.onKick = (x, z, power) => { vfx.stroke(x, z, power); };
  scene.add(a.root);
  return a;
}
function buildActors(m) {
  for (const a of athletes) scene.remove(a.root);
  const kits = matchKits(m.teams[0].def, m.teams[1].def, matchCtx && matchCtx.kit);
  m.kits = kits;
  athletes = m.players.map((p) => makeAthlete(m, p));
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
let match = null, acc = 0, userPan = 0, lastWho = null;
// Diagnostics hook (read-only): window.__wp26() returns the controlled player's state.
window.__wp26log = [];
window.__wp26match = () => match; // test hook
window.__wp26 = () => match && match.human ? { name: match.human.name, x: +match.human.pos.x.toFixed(2), z: +match.human.pos.z.toFixed(2),
  hasBall: match.ball.owner === match.human, cmd: match.humanCmd, phase: match.phase, time: +match.time.toFixed(2), tier, replaying: !!replay } : null;
let toastT = 0, timingT = 0, tacticIdx = 0, lastOwnerTeam = -1, lastScore = [0, 0];
const camState = { focus: new THREE.Vector3(), goalT: 0, goalPoint: new THREE.Vector3(), goalSide: 1, shotT: 0, shotGoalX: 0 };
let replay = null, pendingReplay = null;

let matchCtx = null, paused = false;
function startMatch(ctx) {
  matchCtx = ctx; paused = false;
  const cfg = { seed: (Math.random() * 1e9) | 0, humanTeam: 0, cpu: DIFF[opts.difficulty], assist: opts.assist, periodDuration: opts.minutes * 60, timing: opts.timing, autoSwitch: opts.autoSwitch !== false };
  match = new Match(cfg, state.userTeamDef(), state.opponentTeamDef(ctx.opponent, ctx.rating));
  heroPreview = null; setBall(state.data.club.ball || 'classic');
  const pool = POOLS.find((x) => x.id === state.data.club.pool);   // the club's home pool sets the arena ambience
  arena.setAmbience(ctx.away || !pool ? opts.ambience : pool.ambience);
  tacticIdx = Math.max(0, TACTICS.indexOf(state.data.club.tactic));
  if (ctx.mode === 'challenge') match.startDrill(ctx.drill); else match.start();
  drillKey = '';
  tape.length = 0; record(match, []); record(match, []);
  buildActors(match);
  replay = null; pendingReplay = null; camState.goalT = 0;
  $('hud').classList.remove('hidden');
  $('home-name').textContent = match.teams[0].def.short; $('away-name').textContent = match.teams[1].def.short;
  $('home-chip').style.background = hex(match.teams[0].def.color); $('away-chip').style.background = hex(match.teams[1].def.color);
  $('home-crest').innerHTML = crest(match.teams[0].def); $('away-crest').innerHTML = crest(match.teams[1].def);
  lastOwnerTeam = -1; lastScore = [0, 0]; $('banner').className = 'hidden'; trail.n = 0;
  refreshTactic(); refreshChips();
  lockLandscape();
  audio.start();
  $('shotclock').style.visibility = ''; $('drill').classList.toggle('hidden', ctx.mode !== 'challenge'); document.body.classList.toggle('challenge', ctx.mode === 'challenge');
  const kickOff = () => { if (opts.intro !== false && ctx.mode !== 'challenge') startIntro(); else audio.whistle(true); };
  goalCardT = 0; $('goalcard').className = ''; $('olabel').style.visibility = 'hidden';
  if (ctx.mode !== 'challenge' && opts.lineups !== false) showLineups(kickOff); else kickOff();   // line-ups, then the pool entry
}

// ------------------------------------------------------------------ pool entry cinematic
// Before the swim-off: both teams stand on the deck behind their goal line, dive into the pool one
// after the other (splashes), glide to their start positions; the camera cuts between the two ends
// then rises to the match view. Tap to skip. The simulation does not run meanwhile.
let intro = null;
const INTRO_T = 7.2;
function startIntro() {
  const m = match;
  intro = { t: 0, actors: m.players.map((p, i) => {
    const t = p.team, s = m.sign(t), order = p.isGK ? 3 : [0, 5, 2, 4, 1, 6][p.slot];
    return { i, t, s, start: { x: p.pos.x, z: p.pos.z }, deck: { x: -s * 15.1, z: p.isGK ? 0 : -6 + order * 2 },
      entry: { x: -s * 13.0 }, jump: (t === 0 ? 1.0 : 3.2) + order * 0.17, splashed: false };
  }) };
  const ov = $('intro');
  ov.innerHTML = `<div class="it-vs"><b style="background:${hex(m.teams[0].def.color)}">${m.teams[0].def.short}</b><i>${L('ui.vs')}</i><b style="background:${hex(m.teams[1].def.color)}">${m.teams[1].def.short}</b></div><small>${L('hud.skip')}</small>`;
  ov.classList.remove('hidden'); document.body.classList.add('intro-on');
  ov.onclick = () => endIntro();
  arena.cheer(-1, 0.8);
}
function endIntro() {
  if (!intro) return;
  intro = null; $('intro').classList.add('hidden'); document.body.classList.remove('intro-on');
  for (const p of match.players) athletes[p.id].root.position.set(p.pos.x, 0, p.pos.z);
  camState.focus.set(0, 0, 0); audio.whistle(true);
}
function updateIntro(dt) {
  const it = intro, m = match; it.t += dt;
  const DIVE = 0.75, GLIDE = 1.3;
  for (const a of it.actors) {
    const ath = athletes[a.i], u = (it.t - a.jump) / DIVE;
    const st = { x: a.deck.x, z: a.deck.z, fx: a.s, fz: 0, vx: 0, vz: 0, hasBall: false, charging: false, charge: 0, block: 0, stamina: 1, ball: ballMesh.position, receive: false };
    if (u < 0) {   // standing on the deck
      ath.update(dt, st); ath.overridePose('stand'); ath.root.position.set(a.deck.x, 0.3 + ath.standHeight(), a.deck.z);
    } else if (u < 1) {   // flight: ballistic arc head first
      const x = a.deck.x + (a.entry.x - a.deck.x) * u, y = (0.3 + ath.standHeight()) * (1 - u) - 0.25 * u + 1.1 * u * (1 - u);
      st.x = x; ath.update(dt, st); ath.overridePose('dive', u); ath.root.position.set(x, y, a.deck.z);
    } else {   // entry splash, glide / swim to the start position, then tread water
      if (!a.splashed) { a.splashed = true; vfx.burst(a.entry.x, a.deck.z, 1.3); audio.splash(0.9); }
      const g = Math.min(1, (it.t - a.jump - DIVE) / GLIDE), e = g * g * (3 - 2 * g);
      const x = a.entry.x + (a.start.x - a.entry.x) * e, z = a.deck.z + (a.start.z - a.deck.z) * e;
      Object.assign(st, { x, z, vx: g < 1 ? a.s * 1.6 : 0, vz: 0 });
      ath.update(dt, st);
    }
  }
  // camera: home end (dives), away end (dives), then rising wide shot over the pool
  const tt = it.t; let p, l, fov = 45;
  if (tt < 3.0) { const k = tt / 3; p = tmp.set(-6 - 3 * k, 4.6 - 1.4 * k, -9 + 1.5 * k); l = tmp2.set(-14, 0.8, 0); }
  else if (tt < 5.2) { const k = (tt - 3) / 2.2; p = tmp.set(6 + 3 * k, 4.6 - 1.4 * k, -9 + 1.5 * k); l = tmp2.set(14, 0.8, 0); }
  else { const k = Math.min(1, (tt - 5.2) / 2), e = k * k * (3 - 2 * k); p = tmp.set(0, 1.2 + 9 * e, -7 - 12 * e); l = tmp2.set(0, 0, 0); fov = 40 + 10 * e; }
  if (tt < 0.05 || Math.abs(tt - 3.0) < dt || Math.abs(tt - 5.2) < dt) camera.position.copy(p); else camera.position.lerp(p, 1 - Math.exp(-dt * 5));
  camera.lookAt(l); setFov(fov, dt, 8);
  selRing.visible = selArrow.visible = passRing.visible = false;
  if (it.t >= INTRO_T) {
    endIntro();
  }
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// ------------------------------------------------------------------ event reactions
/** Visual + audio reactions shared by live play and replays. */
function react(e) {
  const a = e.player >= 0 ? athletes[e.player] : null;
  switch (e.type) {
    case Ev.PASS: {
      if (a) a.playThrow(e.kind === 'lob' ? 'lob' : 'pass'); vfx.burst(e.pos.x, e.pos.z, 0.35); audio.ballHit(0.5);
      if (e.team === 0 && !replay && e.kind && e.kind !== 'normal') toast(L('hud.pass_' + e.kind), 1);
      const rcv = e.other >= 0 ? athletes[e.other] : null;   // the passer looks at his team-mate
      if (a && rcv) a.lookAtFor(rcv.root.position.x, 0.4, rcv.root.position.z, 0.6);
      break;
    }
    case Ev.SHOT:
      if (a) a.playThrow(e.lob ? 'lob' : e.power ? 'power' : 'shot'); vfx.burst(e.pos.x, e.pos.z, 0.9); audio.ballHit(1.2);
      if (e.gk >= 0 && athletes[e.gk]) setTimeout(() => athletes[e.gk] && athletes[e.gk].playDive(e.diveDir), 160);
      arena.cheer(e.pos.x < -7 ? 0 : e.pos.x > 7 ? 2 : 1, 0.35);
      break;
    case Ev.SAVE: if (a) a.playSave(); vfx.burst(e.pos.x, e.pos.z, 1.6); audio.splash(1.4); audio.ballHit(1); arena.cheer(-1, 0.6); break;
    case Ev.BLOCK: vfx.burst(e.pos.x, e.pos.z, 0.8); audio.ballHit(0.8); break;
    case Ev.FRAME: vfx.burst(e.pos.x, e.pos.z, 0.6); audio.post(); arena.cheer(-1, 0.5); break;
    case Ev.DODGE: if (a) { a.playReach(e.value || 1); vfx.burst(e.pos.x, e.pos.z, 0.6); audio.splash(0.5); } break;
    case Ev.DODGE_FAIL: if (a) vfx.burst(e.pos.x, e.pos.z, 0.4); break;
    case Ev.INTERCEPT: case Ev.STEAL:
      if (a) { const r = a.root, dx = e.pos.x - r.position.x, dz = e.pos.z - r.position.z; a.playReach(Math.cos(r.rotation.y) * dx - Math.sin(r.rotation.y) * dz > 0 ? 1 : -1); }
      vfx.burst(e.pos.x, e.pos.z, 0.5); audio.splash(0.5); break;
    case Ev.GOAL: {
      arena.netHit(e.pos.x, e.pos.z, e.pos.y, 1.6); vfx.burst(e.pos.x, e.pos.z, 2.6); audio.netHit(); audio.roar(1.2);
      arena.cheer(-1, 1.5);
      if (a) a.playCelebrate(e.team === 0 ? state.celebration() : 'arms');
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
  if (e.type === Ev.DRILL) {
    const d = m.drill; drillKey = '';
    if (e.value && d.why !== 'goal') banner('ok', L('drill.step_ok'), '', -1, 1.4);
    else if (!e.value && d.why !== 'save') banner('excl', L(d.why === 'dead' && m.shotClockLeft <= 0 ? 'drill.time' : 'drill.missed'), '', -1, 1.4);
    haptic(e.value ? [30, 30, 60] : 40);
  }
  if (e.type === Ev.SAVE) banner('save', L('hud.save'), '', e.team, 1.3);
  else if (e.type === Ev.SHOT_CLOCK && m.drill) { /* challenge timer: reported by the DrillResult banner */ }
  else if (e.type === Ev.SHOT_CLOCK) { banner('clock', L('hud.clock_title'), L('hud.shotclock_violation'), -1, 1.8); haptic(20); }
  else if (toastMap[e.type]) toast(L(toastMap[e.type]), 1.1);
  if ([Ev.FOUL, Ev.OUT, Ev.SHOT_CLOCK].includes(e.type)) audio.whistle(false);
  if (e.type === Ev.OFFSIDE) { toast(L('hud.offside'), 1.8); audio.whistle(false); }
  if (e.type === Ev.NO_SHOT_5M && match && match.players[e.player] && match.players[e.player].human) toast(L('hud.no_shot_5m'), 1.8);
  if (e.type === Ev.DODGE && e.team === 0 && e.other >= 0) toast(L('hud.dodge'), 0.9);
  if (e.type === Ev.EXCLUSION) { const p = match && match.players[e.player]; banner('excl', L('hud.excl_title'), L('hud.exclusion', p ? p.number : ''), p ? p.team : -1, 2.4); audio.whistle(true); haptic(40); }
  if (e.type === Ev.REENTRY && match && match.players[e.player] && match.players[e.player].team === 0) toast(L('hud.reentry'), 1);
  if (e.type === Ev.PERIOD_START) audio.whistle(true);
  if (e.type === Ev.GOAL) {
    goalCard(e); flash();
    camState.goalT = 1.5; camState.goalPoint.set(e.pos.x, 0, e.pos.z); camState.goalSide = Math.sign(e.pos.x) || 1;
    if (opts.replays && matchCtx.mode !== 'challenge') pendingReplay = { at: 1.5 };
    // Team-mates close to the scorer join the celebration.
    const scorer = e.player >= 0 ? m.players[e.player] : null;
    if (scorer) for (const p of m.teams[scorer.team].field) if (p !== scorer && Math.hypot(p.pos.x - scorer.pos.x, p.pos.z - scorer.pos.z) < 5) athletes[p.id].playCelebrate('arms');
    if (e.team === human && navigator.vibrate) navigator.vibrate([60, 40, 120]);
  }
  if (e.type === Ev.PERIOD_END) { banner('period', L('hud.period_end', e.value), `${m.teams[0].def.short} ${m.teams[0].score} - ${m.teams[1].score} ${m.teams[1].def.short}`, -1, 2.8); audio.whistle(true); arena.cheer(-1, 0.8); }
  if (e.type === Ev.RESTART || e.type === Ev.PERIOD_START) camState.goalT = 0;
  if (e.type === Ev.SHOT && e.team === human && e.timing && e.timing !== 'NONE') {
    const el = $('timing'); el.textContent = L('hud.timing.' + e.timing.toLowerCase()); el.className = 't-' + e.timing.toLowerCase(); timingT = 1.2;
  }
  if (e.type === Ev.END) { audio.whistle(true); audio.roar(1); arena.cheer(-1, 1.2); setTimeout(() => finishMatch(false), 2200); }
}
function toast(t, s) { $('toast').textContent = t; toastT = s; }

// ------------------------------------------------------------------ replay
function startReplay() {
  if (tape.length < 60) return;
  const start = Math.max(0, tape.length - 50 * 5);
  replay = { frames: tape.slice(start), t: 0, speed: 0.55, angle: 0, shooter: -1, shotU: 0 };
  replay.frames.forEach((f, i) => { for (const e of f.events) if (e.type === Ev.SHOT) { replay.shooter = e.player; replay.shotU = i / (replay.frames.length - 1); } });
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
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
function updateCamera(dt, v) {
  const m = match, c = camState;
  const ball = ballMesh.position;
  let pos, look, fov;
  if (replay) {
    // Two angles: behind the goal (low), then side-on at water level.
    const u = replay.t / (replay.frames.length - 1), side = c.goalSide, sh = replay.shooter >= 0 ? athletes[replay.shooter] : null;
    if (sh && u < replay.shotU + 0.04) {   // over the shooter's shoulder, low over the water, looking at the goal
      const s = sh.root.position, dx = side * 12.5 - s.x, dz = -s.z, l = Math.hypot(dx, dz) || 1;
      pos = tmp.set(s.x - (dx / l) * 1.7 + (dz / l) * 0.55, 1.05, s.z - (dz / l) * 1.7 - (dx / l) * 0.55); look = tmp2.set(side * 12.5, 0.7, 0); fov = 46;
      if (!replay.cut) { camera.position.copy(pos); replay.cut = true; }
    } else if (u < 0.62) { pos = tmp.set(side * 18.5, 2.4, ball.z * 0.4 + 1.5); look = ball.clone(); fov = 34; }
    else if (u < 0.8 && sh) { const s = sh.root.position; pos = tmp.set(s.x - side * 2.4, -1.0, s.z - 2.2); look = tmp2.set(s.x, -0.5, s.z); fov = 58; }   // under the water: the scorer's legs
    else { pos = tmp.set(ball.x - side * 4, 0.9, -7.5); look = ball.clone(); fov = 40; }
    camera.position.lerp(pos, 1 - Math.exp(-dt * 6)); camera.lookAt(look); setFov(fov, dt, 6);
    return;
  }
  if (opts.camera === 'EYES' && c.goalT <= 0 && eyesCamera(dt, v)) return;
  if (opts.camera === 'UNDER' && c.goalT <= 0 && m.human) {   // under the water, beside the controlled player: legs, eggbeater
    const p = m.players[m.human.id], r = athletes[p.id].root.position, s = m.sign(p.team);
    pos = tmp.set(Math.max(-12, Math.min(12, r.x - s * 2.6)), -1.05, Math.max(-9.5, Math.min(9.5, r.z - 2.4)));
    camera.position.lerp(pos, 1 - Math.exp(-dt * 4)); camera.lookAt(r.x, -0.55, r.z); setFov(60, dt, 4);
    return;
  }
  const target = ball.clone();
  if (m.human) target.lerp(athletes[m.human.id].root.position, opts.camera === 'CLOSE' || opts.camera === 'BEHIND' ? 0.55 : 0.25);
  const team = m.possessionTeam, cam = opts.camera;
  const zoom = 1.3 - ((opts.zoom ?? 5) - 1) / 9 * 0.55;   // zoom 1 (far) .. 10 (near)
  const lead = cam === 'DYNAMIC' ? 3 : cam === 'CLOSE' ? 1 : 2;
  if (team >= 0) target.x += (team === 0 ? 1 : -1) * lead;
  if (c.shotT > 0) { c.shotT -= dt; target.x += (c.shotGoalX - target.x) * 0.35; }   // follow the shot toward goal
  const near = Math.min(1, Math.max(0, (Math.abs(ball.x) - 6) / 5));
  let height, back, sideX = 0, clampX = 6, zk = 0.35, lookY = 0.5;
  if (cam === 'ATTACK' && c.goalT <= 0) {
    // End-on, high behind the play, looking down the pool toward the goal the user attacks.
    const dir = m.cfg.humanTeam === 1 ? -1 : 1;
    const fx = Math.max(-8.5, Math.min(8.5, target.x * 0.9 + dir * 1.5 + userPan)), fz = target.z * 0.3;
    c.focus.lerp(tmp2.set(fx, 0, fz), 1 - Math.exp(-dt / 0.3));
    const back = 9 * zoom, h = Math.min(14, 6.6 * zoom);
    camera.position.lerp(tmp.set(Math.max(-23, Math.min(23, c.focus.x - dir * back)), h, c.focus.z * 0.5), 1 - Math.exp(-dt * 4));
    camera.lookAt(c.focus.x + dir * 4.5, 0, c.focus.z * 0.8); setFov(c.shotT > 0 ? 47 : 54, dt, 3);
    userPan += (0 - userPan) * Math.min(1, dt * 0.8);
    return;
  }
  if (cam === 'BEHIND' && m.human && c.goalT <= 0) {
    // Seen from above, from behind the controlled player: high and steep (~60° down), the goal he
    // attacks at the top of the screen, the player in the lower third.
    const dir = m.human.team === 0 ? 1 : -1, h = athletes[m.human.id].root.position;
    c.focus.lerp(tmp2.set(h.x + dir * 3, 0, h.z), 1 - Math.exp(-dt / 0.25));
    camera.position.lerp(tmp.set(c.focus.x - dir * 6.5 * zoom, Math.min(14, 11 * zoom), c.focus.z), 1 - Math.exp(-dt * 4));
    camera.lookAt(c.focus.x, 0, c.focus.z); setFov(55, dt, 3); userPan = 0;
    return;
  }
  if (cam === 'TACTICAL') { height = 13.5; back = 10 + 3.5; fov = 58; target.x *= 0.7; zk = 0.1; }
  else if (cam === 'WIDE') { height = 12; back = 10 + 11; fov = 44; target.x *= 0.6; zk = 0.2; }
  else if (cam === 'CLOSE') { height = 4.6 - 0.8 * near; back = 10 + 1.5; fov = 50; clampX = 3; zk = 0.75; }
  else if (cam === 'DYNAMIC') { height = 6.2 - 1 * near; back = 10 + 4.8 - 1 * near; fov = 52 - 4 * near; sideX = team >= 0 ? -(team === 0 ? 1 : -1) * 2.5 : 0; zk = 0.55; }
  else if (cam === 'DECK') { height = 1.9; back = 10 + 2.6; fov = 46; clampX = 4; zk = 0.5; lookY = 0.2; }
  else { height = 9.5 - 1.5 * near; back = 10 + 7.5 - 1.5 * near; fov = 48 - 6 * near; }
  height *= zoom; back = 10 + (back - 10) * zoom;
  if (c.shotT > 0) fov -= 4 + 4 * Math.min(1, c.shotT);   // small zoom on shots
  target.x = Math.max(-12.5 + clampX, Math.min(12.5 - clampX, target.x + userPan));
  target.z = Math.max(-3.5, Math.min(3.5, target.z * zk)); target.y = 0;
  if (c.goalT > 0) {
    // Goal camera: close, low, 3/4 view of the net and the celebration.
    c.goalT -= dt; target.set(c.goalPoint.x - c.goalSide * 2.5, 0, c.goalPoint.z * 0.5);
    height = 3.2; back = 7.5; fov = 40; sideX = -c.goalSide * 3; lookY = 0.5;
  }
  c.focus.lerp(target, 1 - Math.exp(-dt / 0.25));
  // Stay inside the hall: under the roof (15 m) and in front of the near wall (z = -23.5).
  pos = tmp.set(c.focus.x + sideX, Math.min(height, 14.2), Math.max(c.focus.z - back, -22.8));
  camera.position.lerp(pos, 1 - Math.exp(-dt * 4));
  camera.lookAt(c.focus.x, lookY, c.focus.z);
  setFov(fov, dt, 3);
  userPan += (0 - userPan) * Math.min(1, dt * 0.8);
}
/**
 * First-person camera: in the eyes of the player who has the ball (either team), looking where he looks
 * (the goal while he winds up a shot); no carrier: the controlled player, looking at the ball.
 */
const eyeV = new THREE.Vector3(), eyeL = new THREE.Vector3(), eyeF = new THREE.Vector3();
let eyeSubject = -1;
function eyesCamera(dt, v) {
  const m = match, id = v.owner >= 0 ? v.owner : m.human ? m.human.id : -1; if (id < 0) return false;
  const a = athletes[id], p = m.players[id]; if (!a || p.benched) return false;
  a.root.updateMatrixWorld(true); a.head.getWorldPosition(eyeV);
  const f = eyeF.set(p.facing.x, 0, p.facing.z); if (f.lengthSq() < 1e-4) f.set(m.sign(p.team), 0, 0); f.normalize();
  eyeV.y += 0.1; eyeV.addScaledVector(f, 0.17);   // eye level, just in front of the face (the head stays behind the lens)
  if (v.owner === id && p.charging) { const g = m.targetGoal(p.team); eyeL.set(g.x, 0.75, g.z); }
  else if (v.owner === id) eyeL.copy(eyeV).addScaledVector(f, 10).setY(0.35);
  else eyeL.copy(ballMesh.position);
  const snap = id !== eyeSubject; eyeSubject = id;
  if (snap) { camera.position.copy(eyeV); c_eyeLook.copy(eyeL); }
  else { camera.position.lerp(eyeV, 1 - Math.exp(-dt * 18)); c_eyeLook.lerp(eyeL, 1 - Math.exp(-dt * 6)); }
  camera.near = 0.03; camera.lookAt(c_eyeLook); setFov(72, dt, 6);
  return true;
}
const c_eyeLook = new THREE.Vector3();
function setFov(fov, dt, rate) {
  if (opts.camera !== 'EYES' && camera.near !== 0.1) { camera.near = 0.1; eyeSubject = -1; }
  // Landscape screens narrower than 16:9 (4:3 tablets): keep the same horizontal view of the pool.
  const aspect = LW() / LH(), ref = 16 / 9;
  if (aspect < ref) fov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * ref / aspect) * 180 / Math.PI;
  camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * rate)); camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ per-frame presentation
let prevBallY = 1, prevBallPos = new THREE.Vector3(), dripT = 0, floatT = 0;
const lookGoal = new THREE.Vector3();
const wakeList = [];
function updateWorld(dt, v) {
  // Athletes
  for (let i = 0; i < athletes.length; i++) {
    const s = v.players[i];
    s.hasBall = v.owner === i; s.receive = v.receiver === i && Math.hypot(v.ball.x - s.x, v.ball.z - s.z) < 2.8; s.ball = v.ball;
    // Look: the goal while winding up a shot / holding the ball, the ball otherwise.
    if (s.hasBall && match) { const g = match.targetGoal(match.players[i].team); lookGoal.set(g.x, 0.9, g.z); s.look = s.charging ? lookGoal : null; } else s.look = null;
    athletes[i].update(dt, s);
    if (match) athletes[i].root.visible = !match.players[i].benched;   // DÉFIS: players not involved are out of the water
  }
  // Ball: in the hand when held, simulated position otherwise.
  if (v.owner >= 0) athletes[v.owner].ballWorld(ballMesh.position, time); else ballMesh.position.copy(v.ball);
  const bvx = (ballMesh.position.x - prevBallPos.x) / Math.max(dt, 1e-3), bvz = (ballMesh.position.z - prevBallPos.z) / Math.max(dt, 1e-3);
  ballMesh.rotation.x += bvz * dt * 3.5; ballMesh.rotation.z -= bvx * dt * 3.5;
  // Ball meets the water: splash scaled by its speed.
  if (v.owner < 0 && prevBallY > 0.2 && ballMesh.position.y <= 0.16) {
    const sp = Math.hypot(bvx, bvz); vfx.burst(ballMesh.position.x, ballMesh.position.z, Math.min(1.4, 0.2 + sp / 10)); audio.splash(Math.min(1, sp / 10));
  }
  // Ball floating on the water: gentle bob and roll, small rings around it.
  if (v.owner < 0 && ballMesh.position.y < 0.2 && Math.hypot(bvx, bvz) < 1.5) {
    ballMesh.position.y += Math.sin(time * 2.1) * 0.012; ballMesh.rotation.z += Math.sin(time * 0.9) * dt * 0.15;
    floatT -= dt; if (floatT <= 0) { floatT = 1.3; water.ripple(ballMesh.position.x, ballMesh.position.z, 0.25); }
  }
  updateTrail(v.owner < 0 && Math.hypot(bvx, bvz) > 4, ballMesh.position);
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
  selRing.visible = hi >= 0 && !replay && opts.camera !== 'EYES'; selArrow.visible = false;   // the name label + triangle (HUD) marks the controlled player
  if (hi >= 0) {
    const r = athletes[hi].root.position; selRing.position.set(r.x, 0.04, r.z);
    selArrow.position.set(r.x, 1.75 + Math.sin(performance.now() / 180) * 0.1, r.z); selArrow.rotation.y += dt * 3;
  }
  passRing.visible = false;
  const me = match.human;
  if (!replay && me && match.ball.owner === me) {
    const target = match.chooseTarget(me, currentMove, match.cfg.assist, me.prof.risk, match.teams[me.team].tp.center);
    if (target) {
      // Preview: green ring on the receiver, yellow ring on the water where a pass in depth / laid pass will land.
      const kind = match.passKind(me, target, input.B.held && bCtx);
      if (kind === 'depth' || kind === 'lay') {
        const sp = kind === 'depth' ? match.depthSpot(me, target) : { x: target.pos.x + (match.targetGoal(me.team).x > 0 ? 1 : -1), z: target.pos.z };
        passRing.position.set(sp.x, 0.04, sp.z); passRing.material.color.setHex(0xffd21a);
      } else { const r = athletes[target.id].root.position; passRing.position.set(r.x, 0.04, r.z); passRing.material.color.setHex(0x4dff73); }
      passRing.visible = true;
    }
  } else if (!replay && match.ball.state === 'PASSED' && match.ball.landing && match.ball.passKind !== 'normal' && match.ball.passKind !== 'lob') {
    passRing.position.set(match.ball.landing.x, 0.04, match.ball.landing.z); passRing.material.color.setHex(0xffd21a); passRing.visible = true;
  }
  arena.focusShadows(camState.focus.x, camState.focus.z);
}

/** Applies the result to the save (coins, XP, objectives, league / event) and shows the results screen. */
function finishMatch(forfeit) {
  if (!match) return;
  const m = match, ctx = matchCtx;
  let hs = m.teams[0].score, as = m.teams[1].score;
  const stats = { ...m.stats.teams[0] }, statsOpp = { ...m.stats.teams[1] };
  if (forfeit) { hs = 0; as = 5; }
  const players = {};   // career stats of the squad players who played
  m.players.forEach((p, i) => { if (p.team === 0 && p.pid) players[p.pid] = m.pstats[i]; });
  if (ctx.mode === 'challenge') {   // DÉFIS: stars and rewards (a quit challenge is not recorded)
    const d = m.drill, result = forfeit ? null : { ...state.recordChallenge(ctx.drill, d.made, d.total), results: d.results.slice() };
    leaveMatch(); goalRing.visible = false;
    if (result) { audio.whistle(false); app.show('challenge', { result }, false); } else { app.tourTab = 'defi'; app.show('tournaments', {}, false); }
    return;
  }
  const summary = ctx.mode === 'quick' && forfeit ? null : state.applyResult(ctx, { hs, as, stats, players });
  leaveMatch();
  if (summary) { audio.whistle(false); app.show('results', { summary, hs, as, stats, statsOpp, opponent: m.teams[1].def.short }, false); }
  else app.home();
}
function leaveMatch() {
  intro = null; $('intro').classList.add('hidden'); document.body.classList.remove('intro-on');
  match = null; paused = false; endReplay();
  for (const a of athletes) scene.remove(a.root);
  athletes = [];
  $('hud').classList.add('hidden'); $('pause').classList.add('hidden');
  buildHero();
}
// ------------------------------------------------------------------ premium HUD: banners, tactics panel, pause menu
const HUD_ICONS = {
  shoot: '<circle cx="9" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M13 9l7-5m-5 8l7-1m-8 4l6 3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  pass: '<path d="M3 12h13m-5-6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  defend: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5Z" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  switch: '<path d="M4 8h12l-3-3m7 11H8l3 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  sprint: '<path d="M13 2L4 14h6l-1 8 9-12h-6Z" fill="currentColor"/>',
  dodge: '<path d="M4 18c4 0 5-12 10-12h5m-3-3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
};
const hudIcon = (k, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${HUD_ICONS[k]}</svg>`;
const btnCache = {};
function setBtn(id, mode, label) {
  const k = mode + '|' + label; if (btnCache[id] === k) return; btnCache[id] = k;
  const b = $(id); b.innerHTML = `${hudIcon(mode)}<span>${label}</span>`; if (b.dataset.mode !== undefined || mode) b.dataset.mode = mode;
}
const haptic = (p) => { if (opts.haptics !== false && navigator.vibrate) navigator.vibrate(p); };
const crest = (def, size = 34) => logoSvg(def.logo || { shape: 'shield', symbol: 'wave' }, def.color, def.color2 ?? 0xffffff, size, def.color3);

/** Big animated banner (goal, save, exclusion, 30 s, period end). */
let bannerT = 0;
function banner(kind, title, sub = '', team = -1, dur = 2) {
  const el = $('banner'), def = team >= 0 && match ? match.teams[team].def : null;
  el.className = 'b-' + kind; void el.offsetWidth;
  el.innerHTML = `${def ? `<span class="b-crest">${crest(def, 56)}</span>` : ''}<div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  el.classList.add('show'); bannerT = dur;
  if (def) el.style.setProperty('--team', hexCss(def.color));
}
if (new URLSearchParams(location.search).has('debug')) window.__hud = { banner: (...a) => banner(...a), goal: (team, player) => goalCard({ team, player }) };   // HUD checks
function flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

// Tactics panel: 5 game styles (+ 2 specialists) and the attacking formation; pauses the match while open.
const STYLE_MAIN = ['OFFENSIVE', 'BALANCED', 'DEFENSIVE', 'PRESSURE', 'COUNTER'], STYLE_MORE = ['FAST', 'CENTER'];
const FORMS = ['arc', 'umbrella', '4-2'];
let tacFromPause = false;
function tacticsHtml() {
  const t = match.teams[match.human ? match.human.team : 0], sel = (on) => (on ? 'on' : '');
  const formSvg = (f) => { const [D, Z] = FORMATIONS[f]; return `<svg viewBox="0 0 60 40" width="60" height="40"><rect x="1" y="1" width="58" height="38" rx="3" fill="#0b5d84" stroke="#fff6"/><rect x="56" y="15" width="3" height="10" fill="#fff"/>
    ${D.map((d, i) => `<circle cx="${56 - d * 4.4}" cy="${20 + Z[i] * 2.2}" r="3" fill="${i === 5 ? '#ffd21a' : '#fff'}"/>`).join('')}</svg>`; };
  return `<div class="tp-box"><h2>${L('btn.tactic')}</h2>
    <div class="tp-styles">${[...STYLE_MAIN, ...STYLE_MORE].map((s) => `<button class="tp-st ${sel(t.tactic === s)} ${STYLE_MORE.includes(s) ? 'more' : ''}" data-style="${s}"><b>${L(TACTIC_KEYS[s])}</b><small>${L('tdesc.' + s)}</small></button>`).join('')}</div>
    <h3>${L('hud.formation')}</h3><div class="tp-forms">${FORMS.map((f) => `<button class="tp-fm ${sel(t.formation === f)}" data-form="${f}">${formSvg(f)}<b>${L('form.' + f)}</b></button>`).join('')}</div>
    <button class="pm-btn primary tp-close">${L(tacFromPause ? 'ui.back' : 'ui.resume')}</button></div>`;
}
function openTactics(fromPause = false) {
  if (!match || !match.human) return;
  tacFromPause = fromPause; paused = true;
  const el = fromPause ? $('pause-panel') : $('tacpanel');
  el.innerHTML = tacticsHtml(); if (!fromPause) el.classList.remove('hidden');
  el.onclick = (e) => {
    const team = match.human.team, s = e.target.closest('[data-style]'), f = e.target.closest('[data-form]');
    if (s) { match.setTactic(team, s.dataset.style); tacticIdx = TACTICS.indexOf(s.dataset.style); refreshTactic(); haptic(12); el.innerHTML = tacticsHtml(); return; }
    if (f) { match.setFormation(team, f.dataset.form); haptic(12); el.innerHTML = tacticsHtml(); return; }
    if (e.target.closest('.tp-close')) { if (fromPause) pausePanel('stats'); else { el.classList.add('hidden'); paused = false; } }
  };
}
// Pause ("JEU EN PAUSE"): score + crests, live statistics, tactics, substitutions, every setting, quit.
const PZ_ICONS = {
  stats: '<path d="M4 20V10h3v10Zm6 0V4h3v16Zm6 0v-7h3v7Z" fill="currentColor"/>',
  tactics: '<rect x="3" y="5" width="18" height="14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 5v14" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9h3v6H3m18-6h-3v6h3" fill="none" stroke="currentColor" stroke-width="2"/>',
  team: '<circle cx="9" cy="8" r="3.2" fill="currentColor"/><circle cx="16.5" cy="9" r="2.6" fill="currentColor"/><path d="M3 19c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5Zm12.5 0c0-2-.6-3.6-1.7-4.6 3.1-.4 5.7 1.2 5.7 4.6Z" fill="currentColor"/>',
  settings: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.3 5-1.9-.3a6.7 6.7 0 0 1-.7 1.7l1.1 1.6-1.5 1.5-1.6-1.1c-.5.3-1.1.6-1.7.7l-.3 1.9h-2.2l-.3-1.9a6.7 6.7 0 0 1-1.7-.7l-1.6 1.1-1.5-1.5 1.1-1.6c-.3-.5-.6-1.1-.7-1.7l-1.9-.3v-2.2l1.9-.3c.1-.6.4-1.2.7-1.7L5.3 7.2l1.5-1.5 1.6 1.1c.5-.3 1.1-.6 1.7-.7l.3-1.9h2.2l.3 1.9c.6.1 1.2.4 1.7.7l1.6-1.1 1.5 1.5-1.1 1.6c.3.5.6 1.1.7 1.7l1.9.3Z" fill="currentColor"/>',
  quit: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};
let pzSetTab = 'match', pzSel = null;
function statsHtml() {
  const T = match.teams, a = match.stats.teams[0], b = match.stats.teams[1], tot = a.possession + b.possession || 1;
  const row = (label, x, y, xs, ys) => { const s = (x + y) || 1, k = x / s * 100;
    return `<div class="pz-row"><b>${xs ?? x}</b><span>${label}</span><b>${ys ?? y}</b><i><u style="width:${k}%"></u><u style="width:${100 - k}%"></u></i></div>`; };
  const pa = Math.round(a.possession / tot * 100);
  return row(L('pz.possession'), pa, 100 - pa, pa + '%', (100 - pa) + '%')
    + row(L('pz.shots'), a.shots, b.shots, `${a.shots}(${a.onTarget})`, `${b.shots}(${b.onTarget})`)
    + row(L('pz.saves'), a.saves, b.saves)
    + row(L('pz.passes'), a.passes, b.passes, `${a.passes}(${a.passesOk})`, `${b.passes}(${b.passesOk})`)
    + row(L('pz.steals'), a.steals + a.interceptions, b.steals + b.interceptions)
    + row(L('pz.fouls'), a.fouls, b.fouls, `${a.fouls}(${a.exclusions})`, `${b.fouls}(${b.exclusions})`)
    + row(L('pz.manup'), a.ppChances, b.ppChances, `${a.ppChances}(${a.ppGoals})`, `${b.ppChances}(${b.ppGoals})`);
}
/** Substitutions (rolling, as in water polo): tap a player in the water, then a substitute. */
function teamHtml() {
  const inWater = [...match.teams[0].field, match.teams[0].gk], bench = state.bench().sort((x, y) => (x.role === 'GOALKEEPER') - (y.role === 'GOALKEEPER'));
  const card = (p, extra, sel) => `<div class="sub-card ${sel ? 'sel' : ''}" ${extra}>${cardHtml(p)}</div>`;
  const wp = inWater.map((mp) => { const sq = mp.pid ? state.player(mp.pid) : null; if (!sq) return '';
    return card({ ...sq, form: Math.round(mp.stamina * 100) }, `data-in="${mp.id}"`, pzSel === mp.id); }).join('');
  return `<p class="pz-hint">${L(pzSel === null ? 'pz.sub_pick' : 'pz.sub_bench')}</p><div class="sub-grid">${wp}</div><h4>${L('ui.bench')}</h4>
    <div class="sub-grid subs">${bench.map((p) => card(p, `data-bench="${p.id}"`, false)).join('') || `<p class="pz-hint">—</p>`}</div>`;
}
function substitute(mpId, benchId) {
  const mp = match.players[mpId], sq = state.player(benchId); if (!mp || !sq || mp.excluded > 0) return false;
  if (mp.isGK !== (sq.role === 'GOALKEEPER')) { toast(L(mp.isGK ? 'pz.need_gk' : 'pz.no_gk'), 1.5); return false; }
  const old = mp.pid; match.substitute(mp, state.playerDef(sq, mp.isGK ? -1 : mp.slot));
  if (old) state.swap(old, benchId);   // the line-up follows (career stats, next match)
  scene.remove(athletes[mpId].root); athletes[mpId] = makeAthlete(match, mp); athletes[mpId].root.position.set(mp.pos.x, 0, mp.pos.z);
  lastWho = null; haptic([20, 30, 20]); return true;
}
function pausePanel(kind) {
  const el = $('pause-panel'), keep = el.dataset.kind === (kind || 'stats') ? el.scrollTop : 0; el.onclick = null; el.onchange = null; kind = kind || 'stats'; el.dataset.kind = kind;
  requestAnimationFrame(() => { el.scrollTop = keep; });
  document.querySelectorAll('.pz-btns button').forEach((b) => b.classList.toggle('sel', b.id === 'pause-' + kind));
  if (kind === 'tactics') return openTactics(true);
  if (kind === 'stats') { el.innerHTML = `<div class="pz-stats">${statsHtml()}</div>`; return; }
  if (kind === 'team') {
    el.innerHTML = `<div class="pz-team">${teamHtml()}</div>`;
    el.onclick = (e) => {
      const a = e.target.closest('[data-in]'), b = e.target.closest('[data-bench]');
      if (a) { pzSel = +a.dataset.in === pzSel ? null : +a.dataset.in; pausePanel('team'); }
      else if (b && pzSel !== null) { if (substitute(pzSel, b.dataset.bench)) { pzSel = null; toast(L('pz.subbed'), 1.2); } pausePanel('team'); }
    };
    fillPortraits(el, [...match.teams[0].players.map((mp) => mp.pid && state.player(mp.pid)).filter(Boolean), ...state.bench()]);
    return;
  }
  if (kind === 'settings') {
    const help = pzSetTab === 'controls' ? `<div class="ctl-list">${[['stick', 'ctl.stick'], ['shoot', 'ctl.shoot'], ['pass', 'ctl.pass'], ['defend', 'ctl.defend'], ['switch', 'ctl.switch'], ['sprint', 'ctl.sprint'], ['dodge', 'ctl.dodge'], ['pass', 'ctl.passes']]
      .map(([i, k]) => `<div>${i === 'stick' ? '<i class="ctl-stick"></i>' : `<i class="ctl-i m-${i}">${hudIcon(i, 18)}</i>`}<span>${L(k)}</span></div>`).join('')}</div>` : '';
    el.innerHTML = app.settingsPanel(pzSetTab) + help;
    el.onclick = async (e) => { const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
      if (a === 'set-tab') pzSetTab = b.dataset.arg; else await app.settingsAct(a, b.dataset.arg);
      refreshChips(); pausePanel('settings'); };
    el.onchange = async (e) => { if (e.target.dataset.slide) { await changeSetting(e.target.dataset.slide, 0, +e.target.value); pausePanel('settings'); } };
    return;
  }
  if (kind === 'quit') {
    el.innerHTML = `<div class="pz-quit"><h2>${L('ui.quit_match')}</h2><p>${matchCtx.mode === 'challenge' ? L('drill.quit') : matchCtx.mode === 'quick' ? L('ui.quit_quick') : L('ui.quit_warn')}</p>
      <button class="pm-btn danger" id="quit-yes">${L('ui.confirm')}</button></div>`;
    el.onclick = (e) => { if (e.target.id === 'quit-yes') { closePause(); finishMatch(matchCtx.mode !== 'quick'); } };
  }
}
function openPause() {
  if (!match || match.finished) return;
  paused = true; pzSel = null; $('pause').classList.remove('hidden'); $('tacpanel').classList.add('hidden');
  const T = match.teams;
  $('pause-score').innerHTML = `<span>${crest(T[0].def, 52)}<b>${T[0].def.short}</b></span><strong>${T[0].score} - ${T[1].score}</strong><span><b>${T[1].def.short}</b>${crest(T[1].def, 52)}</span><small>${$('clock').textContent}</small>`;
  $('pause-title').textContent = L('pz.paused');
  for (const k of ['stats', 'tactics', 'team', 'settings', 'quit']) { const b = $('pause-' + k); b.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">${PZ_ICONS[k]}</svg><small>${L('pz.' + k)}</small>`; b.onclick = () => pausePanel(k); }
  pausePanel('stats');
}
function closePause() { paused = false; $('pause').classList.add('hidden'); $('pause-panel').innerHTML = ''; }

function cycleTactic() { if (!match || !match.human) return; tacticIdx = (tacticIdx + 1) % TACTICS.length; match.setTactic(match.human.team, TACTICS[tacticIdx]); refreshTactic(); }
function refreshTactic() { if (match) $('tactic').textContent = `${L('btn.tactic')}: ${L(TACTIC_KEYS[TACTICS[tacticIdx]])}`; }
function refreshChips() { $('camBtn').innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24"><path d="M3 7h13v10H3zM16 10l5-3v10l-5-3" fill="currentColor"/></svg> ${L(CAM_LABEL[opts.camera] || 'cam.' + opts.camera.toLowerCase())}`; $('soundBtn').textContent = opts.sound ? '🔊' : '🔇'; }

// ------------------------------------------------------------------ LANDSCAPE ONLY
const isPortrait = () => false;   // never blocks: the game turns itself to landscape
function lockLandscape() {
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch {}
}
let layoutKey = '';
function updateOrientationGate() {
  const key = innerWidth + 'x' + innerHeight; if (key === layoutKey) return false; layoutKey = key;
  fakeLand = innerHeight > innerWidth;
  const d = document.documentElement, W = LW(), H = LH();
  d.classList.toggle('fake-land', fakeLand);
  d.style.setProperty('--lw', W + 'px'); d.style.setProperty('--lh', H + 'px'); d.style.setProperty('--vw', W / 100 + 'px'); d.style.setProperty('--vh', H / 100 + 'px');
  // size rules of the stylesheets (media queries see the upright screen in this mode)
  for (const [c, on] of [['mq-h420', H <= 420], ['mq-h500', H <= 500], ['mq-h380', H <= 380], ['mq-arw', W / H >= 21 / 9], ['mq-arn', W / H <= 1.6]]) d.classList.toggle(c, on);
  return false;
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

  if (match && intro) {
    updateIntro(fdt);
    arena.drawScreen({ home: match.teams[0].def.short, away: match.teams[1].def.short, hs: 0, as: 0, clock: 'P1  00:00' });
  } else if (match) {
    let v;
    if (replay) {
      replay.t += fdt * 50 * replay.speed;
      const i = Math.min(replay.frames.length - 2, Math.floor(replay.t));
      if (Math.floor(replay.t - fdt * 50 * replay.speed) < i) for (const e of replay.frames[i].events) react(e);   // re-play visual reactions
      v = buildView(replay.frames[i], replay.frames[i + 1], replay.t - i);
      if (replay.t >= replay.frames.length - 1) endReplay();
    } else {
      if (!match.finished && !paused) {
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
      clock: `P${match.period}  ${quarterClock(match)}` });
    audio.setCrowd(Math.max(...arena.excite));
  } else if (showcase) {
    // Debug / presentation: athletes side by side in each animation state, slow orbit.
    showcase.forEach((a, i) => a.update(fdt, a.showcaseState(time)));
    showcase.forEach((a, i) => {   // a ball for each athlete holding one, placed exactly like in a match
      const has = a.showcaseState(time).hasBall;
      if (!a.ball) { a.ball = ballMesh.clone(); scene.add(a.ball); }
      a.ball.visible = a.root.visible && (has || a.throwT > 0.2); if (a.ball.visible) a.ballWorld(a.ball.position, time);
    });
    const ang = time * 0.25, focus = new URLSearchParams(location.search).get('focus');
    if (focus !== null) {   // ?showcase&focus=i : face close-up of athlete i
      const fx = (+focus - 2.5) * 0.85, fa = Math.sin(time * 0.5) * 0.7, fy = showcase[+focus].morph.height;
      if (new URLSearchParams(location.search).has('side')) { showcase.forEach((a, i) => { a.root.visible = i === +focus; }); camera.position.set(fx + 2.6, 0.55, 0.6); camera.lookAt(fx, 0.35, 0); setFov(40, fdt, 10); }   // ?side: profile view
      else {   // ?ly= look height, &d= distance, &a= fixed angle (debug close-ups: chest, back)
        const Q = new URLSearchParams(location.search), ly = Q.has('ly') ? +Q.get('ly') : 0.33 * fy, dd = Q.has('d') ? +Q.get('d') : 0.9, aa = Q.has('a') ? +Q.get('a') : fa;
        camera.position.set(fx + Math.sin(aa) * dd, ly + 0.17 * fy, -Math.cos(aa) * dd); camera.lookAt(fx, ly, 0); setFov(40, fdt, 10);
      }
    } else { camera.position.set(Math.sin(ang) * 1.2, 0.9, -3.6 + Math.cos(ang) * 0.4); camera.lookAt(0, 0.35, 0); setFov(40, fdt, 10); }
    ballMesh.position.set(0, -5, 0);
    selRing.visible = selArrow.visible = passRing.visible = false;
  } else {
    // Menu: the hero treads water in front of a slow orbit of the arena (pre-match: two players on the deck).
    if (!hero) buildHero();
    hero.root.visible = heroVisible && !pmView;
    if (pmView) { updatePrematchView(fdt); selRing.visible = selArrow.visible = passRing.visible = false; ballShadow.material.opacity = 0; trail.line.visible = false; renderer.render(scene, camera); return; }
    const yaw = heroYaw + Math.sin(time * 0.3) * 0.3;
    hero.update(fdt, { x: 0, z: -6, fx: Math.sin(yaw), fz: -Math.cos(yaw), vx: 0, vz: 0, hasBall: true, charging: false, charge: 0, block: 0, stamina: 1, ball: new THREE.Vector3(0, 1, -12), receive: false });
    if (heroPreview) hero.root.position.y = 0.62;   // editor: lifted (eggbeater) so the suit is visible
    hero.handWorld(ballMesh.position);
    // Hero framed in the centre-left gap of the home screen; slow parallax sway.
    const ang = Math.sin(time * 0.15) * 0.15;
    camera.position.set(Math.sin(ang) * 5.2 - 1.4, 0.9, -6 - Math.cos(ang) * 5.2);
    camera.lookAt(-1.4 - 0.25, 0.75, -6);
    setFov(40, fdt, 10);
    water.setWakes([{ x: 0, z: -6, vx: 0, vz: 0 }]);
    selRing.visible = selArrow.visible = passRing.visible = false; ballShadow.material.opacity = 0; trail.line.visible = false;
  }
  underwaterLook();
  renderer.render(scene, camera);
}
// Camera under the surface: turquoise water fog and background (restored above the surface).
let uwSaved = null;
const uwLight = new THREE.HemisphereLight(0x9fe8ff, 0x2fb8d8, 1.6);   // light scattered by the water all around
function underwaterLook() {
  const under = camera.position.y < -0.02;
  if (under && !uwSaved) { uwSaved = { fog: scene.fog, bg: scene.background }; scene.add(uwLight); scene.fog = new THREE.Fog(0x17a9c9, 0.5, 17); scene.background = new THREE.Color(0x17a9c9); UW_STRENGTH.value = 0.15; }
  else if (!under && uwSaved) { scene.fog = uwSaved.fog; scene.background = uwSaved.bg; uwSaved = null; UW_STRENGTH.value = 1; scene.remove(uwLight); }
}

// Radar: the whole pool seen from above (players, ball, controlled player), redrawn at ~15 Hz.
let radarT = 0;
function drawRadar(m) {
  const cv = $('radar'); cv.hidden = opts.radar === false || !!replay; if (cv.hidden) return;
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), sx = W / 27, sz = H / 21, X = (x) => W / 2 + x * sx, Z = (z) => H / 2 - z * sz;
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(8, 40, 70, 0.62)'; g.fillRect(X(-12.5), Z(10), 25 * sx, 20 * sz);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.strokeRect(X(-12.5), Z(10), 25 * sx, 20 * sz);
  g.beginPath(); g.moveTo(X(0), Z(10)); g.lineTo(X(0), Z(-10)); g.stroke();
  for (const gx of [-12.5, 12.5]) { g.fillStyle = '#fff'; g.fillRect(X(gx) - 1.5, Z(1.5), 3, 3 * sz); }
  const col = [hexCss(m.teams[0].def.color), '#f2f4f7'];
  for (const p of m.players) {
    g.fillStyle = p.isGK ? '#d81a1f' : col[p.team]; g.beginPath(); g.arc(X(p.pos.x), Z(p.pos.z), p.human ? 5 : 3.8, 0, 7); g.fill();
    if (p.human) { g.strokeStyle = '#ffe14a'; g.lineWidth = 1.5; g.stroke(); }
  }
  g.fillStyle = '#ffd21a'; g.beginPath(); g.arc(X(m.ball.pos.x), Z(m.ball.pos.z), 3, 0, 7); g.fill();
}
// DÉFIS panel: name, attempts (✓ / ✗), instruction; the shot clock shows the time left for the attempt.
let drillKey = '';
function updateDrill(m) {
  const d = m.drill, key = `${d.n}|${d.results.length}|${d.step}`;
  $('clock').textContent = L('drill.' + d.kind); $('shotclock').style.visibility = d.step ? 'hidden' : '';
  goalRing.visible = !!d.target && m.phase === 'LIVE';
  if (d.target) { goalRing.position.set(d.target.x, 0.05, d.target.z); goalRing.scale.setScalar(2.2 + Math.sin(performance.now() / 200) * 0.25); }
  if (key === drillKey) return; drillKey = key;
  const dots = d.step ? DRILLS.tutorial.steps.map((st, i) => `<i class="${i < d.n ? 'ok' : i === d.n ? 'cur' : ''}">${i + 1}</i>`).join('')
    : Array.from({ length: d.total }, (_, i) => `<i class="${i < d.results.length ? (d.results[i] ? 'ok' : 'ko') : i === d.results.length ? 'cur' : ''}">${i < d.results.length ? (d.results[i] ? '✓' : '✗') : i + 1}</i>`).join('');
  $('drill').innerHTML = `<div class="dr-dots">${dots}</div><p>${L(d.step ? 'drill.t_' + d.step : 'drill.' + d.kind + '_how')}</p>`;
}
const hexCss = (c) => '#' + c.toString(16).padStart(6, '0');
// ------------------------------------------------------------------ presentation: player cards, goal card, line-ups
const flagOf = (code) => (countryOf(code) || {}).flag || '';
const FORM_NAME = { arc: 'form.arc', umbrella: 'form.umbrella', '4-2': 'form.4-2' };
/** Gold player card: 3D portrait (filled in progressively), rating, poste, flag, name, form bar. */
function cardHtml(p, opts = {}) {
  const ovr = p.ovr ?? overall(p), tier = ovr >= 85 ? 'gold' : ovr >= 75 ? 'silver' : 'bronze';
  return `<div class="pc3 ${tier}" ${opts.style ? `style="${opts.style}"` : ''} data-pid="${p.id}">
    <span class="pc3-img"><svg viewBox="0 0 64 64"><path d="M14 64 Q16 44 32 42 Q48 44 50 64Z" fill="#0004"/><ellipse cx="32" cy="28" rx="12" ry="14" fill="#0003"/></svg></span>
    <b class="pc3-ovr">${ovr}</b><i class="pc3-pos">${ROLE_ABBR[p.role] || ''}</i><span class="pc3-flag">${flagOf(p.nationality)}</span>
    <span class="pc3-name">${(p.lastName || p.name || '').replace(/^.\. /, '')}</span><u class="pc3-bar" style="width:${Math.round(p.form ?? 100)}%"></u></div>`;
}
/** Fills the portraits of the cards in `root` one by one (each one is a small off-screen render). */
function fillPortraits(root, players, kits) {
  players.forEach((p, i) => setTimeout(() => {
    const el = root.querySelector(`[data-pid="${p.id}"] .pc3-img`); if (!el || !el.isConnected) return;
    const url = (() => { try { return portraitFor(p, kits); } catch { return null; } })(); if (url) el.innerHTML = `<img src="${url}" alt="">`;
  }, 60 + i * 70));
}
// Goal: team bar + scorer bar, the scorer's card, confetti; skip button.
let goalCardT = 0;
function goalCard(e) {
  const m = match, team = m.teams[e.team], sc = e.player >= 0 ? m.players[e.player] : null;
  let p = null, kits = null;
  if (sc && sc.pid) p = state.player(sc.pid);
  else if (sc) { const sq = state.opponentSquad(team.def.id).find((q) => q.number === sc.number) || null; if (sq) { p = sq; kits = team.def.kits; } }
  const card = p ? cardHtml(p) : '';
  const el = $('goalcard');
  el.innerHTML = `<div class="gc-bars"><div class="gc-top">${crest(team.def, 30)}<b>${team.def.name}</b><i>${L('hud.goal_short')}</i></div>
    <div class="gc-scorer">${sc ? (p ? `${p.firstName} ${p.lastName}` : sc.name) : ''}</div></div>${card}`;
  el.className = 'show'; goalCardT = 3.2;
  if (p) fillPortraits(el, [p], kits);
  confetti([team.def.color, team.def.color2 ?? 0xffffff, 0xffd21a, 0xffffff]);
  $('skipBtn').classList.remove('hidden');
}
function confetti(colors) {
  const box = $('confetti'); box.innerHTML = '';
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i'), col = hexCss(colors[i % colors.length]);
    c.style.cssText = `left:${Math.random() * 100}%;background:${col};animation-delay:${Math.random() * 0.6}s;animation-duration:${2 + Math.random() * 1.6}s;--rx:${Math.random() * 720 - 360}deg;--dx:${Math.random() * 120 - 60}px`;
    box.appendChild(c);
  }
  setTimeout(() => { box.innerHTML = ''; }, 4200);
}
// Line-ups before the swim-off: each team's 7 starters as cards on the pool, team banner (crest, name, TOTAL, formation).
let lineup = null;
const LINE_POS = { 4: [8, 6], 5: [41, 2], 0: [74, 6], 3: [16, 36], 2: [41, 36], 1: [66, 36], '-1': [41, 68] };
function lineupHtml(t) {
  const m = match, def = m.teams[t].def;
  const players = t === 0 ? [state.player(state.lineup.gk), ...state.lineup.slots.map((id) => state.player(id))].map((p, i) => ({ ...p, slot: i ? i - 1 : -1 }))
    : state.opponentSquad(def.id).slice(0, 7).map((p) => ({ ...p, slot: p.slot ?? -1 }));
  const total = t === 0 ? state.teamTotal().total : state.opponentTotal(def.id);
  const html = `<div class="lu-banner" style="--tc:${hexCss(def.color)}">${crest(def, 64)}<div><b>${def.name}</b><span class="lu-ovr">${total}<small>OVR</small></span></div><i>${L(FORM_NAME[m.teams[t].formation] || 'form.arc')}</i></div>
    <div class="lu-pool"><div class="lu-goal"></div><div class="lu-l2"></div><div class="lu-l5"></div>
    ${players.map((p) => { const [x, y] = LINE_POS[p.slot] || [41, 36]; return cardHtml(p, { style: `left:${x}%;top:${y}%` }); }).join('')}</div>`;
  return { html, players, kits: t === 0 ? null : def.kits };
}
function showLineups(done) {
  lineup = { t: 0, team: 0, done }; paused = true;
  document.body.classList.add('lineup-on'); $('lineup').classList.remove('hidden'); $('skipBtn').classList.remove('hidden');
  renderLineup();
}
function renderLineup() {
  const L0 = lineupHtml(lineup.team), el = $('lineup');
  el.innerHTML = L0.html; el.className = 'show t' + lineup.team; lineup.t = 3.4;
  fillPortraits(el, L0.players, L0.kits);
}
function endLineups() {
  if (!lineup) return; const done = lineup.done; lineup = null; paused = false;
  document.body.classList.remove('lineup-on'); $('lineup').className = 'hidden'; $('skipBtn').classList.add('hidden');
  done();
}
function updatePresentation(dt) {
  if (lineup) { lineup.t -= dt; if (lineup.t <= 0) { if (lineup.team === 0) { lineup.team = 1; renderLineup(); } else endLineups(); } }
  if (goalCardT > 0) { goalCardT -= dt; if (goalCardT <= 0) { $('goalcard').className = ''; if (!lineup && !replay) $('skipBtn').classList.add('hidden'); } }
  if (!lineup && !replay && goalCardT <= 0) $('skipBtn').classList.add('hidden'); else if (replay) $('skipBtn').classList.remove('hidden');
}
/** Skip button (>|): next line-up / end of line-ups, goal card + replay. */
function skipPresentation() {
  if (lineup) { if (lineup.team === 0) { lineup.team = 1; renderLineup(); } else endLineups(); return; }
  goalCardT = 0; $('goalcard').className = ''; pendingReplay = null; if (replay) endReplay(); $('skipBtn').classList.add('hidden');
}
// Name labels above the controlled player (+ triangle, stamina, shot charge) and the nearest opponent.
const labelV = new THREE.Vector3();
function placeLabel(el, ath, dy) {
  if (!ath) { el.style.visibility = 'hidden'; return; }
  ath.head.getWorldPosition(labelV); labelV.y += dy; labelV.project(camera);
  if (labelV.z > 1 || Math.abs(labelV.x) > 1.05 || Math.abs(labelV.y) > 1.05) { el.style.visibility = 'hidden'; return; }
  el.style.visibility = 'visible'; el.style.left = ((labelV.x * 0.5 + 0.5) * LW()).toFixed(1) + 'px'; el.style.top = ((-labelV.y * 0.5 + 0.5) * LH()).toFixed(1) + 'px';
}
function updateLabels(m) {
  const me = m.human, show = me && !replay && !intro && !lineup;
  placeLabel($('bars'), show ? athletes[me.id] : null, 0.45);
  let opp = null, d = 5;
  if (show) for (const o of m.teams[1 - me.team].field) { if (o.excluded > 0) continue; const x = Math.hypot(o.pos.x - me.pos.x, o.pos.z - me.pos.z); if (x < d) { d = x; opp = o; } }
  const ol = $('olabel'); if (opp && ol.dataset.id !== String(opp.id)) { ol.dataset.id = opp.id; ol.textContent = opp.name || ''; }
  placeLabel(ol, opp ? athletes[opp.id] : null, 0.35);
}

// Game clock: a real water polo quarter (8:00) shown over the chosen real duration (1, 2, 4 or 8 min);
// the 30 s shot clock and the 20 s exclusions stay in real seconds (gameplay).
const QUARTER = 8 * 60;
function quarterClock(m) {
  const t = Math.max(0, m.periodLeft) * QUARTER / m.cfg.periodDuration, s = Math.ceil(t - 1e-6);
  return `${String((s / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function updateHud(dt) {
  updatePresentation(dt); updateLabels(match);
  const m = match;
  radarT -= dt; if (radarT <= 0) { radarT = 1 / 15; drawRadar(m); }
  $('home-score').textContent = m.teams[0].score; $('away-score').textContent = m.teams[1].score;
  if (m.drill) updateDrill(m);
  else $('clock').textContent = `${L('hud.period', m.period)}  ${quarterClock(m)}`;
  $('shotclock').textContent = Math.ceil(Math.max(0, m.shotClockLeft));
  // Power play indicator: "6 v 5 · 14 s" while a player is excluded
  const ex = m.players.find((p) => p.excluded > 0 && !p.benched), mu = $('manup');
  if (ex) { const n = (t) => 6 - m.teams[t].field.filter((p) => p.excluded > 0 && !p.benched).length; mu.textContent = L('hud.manup', n(1 - ex.team), n(ex.team), Math.ceil(ex.excluded)); mu.className = ex.team === 0 ? 'down' : 'up'; mu.hidden = false; }
  else mu.hidden = true;
  const me = m.human;
  if (me) {
    if (me !== lastWho) {   // controlled player + his poste
      lastWho = me; const w = $('who'), i = document.createElement('i'); i.textContent = L('pos.' + me.slot);
      w.textContent = `${me.name || '#' + me.number} `; w.appendChild(i);
      w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash');   // player switch
    }
    const st = $('stamina'); st.style.width = me.stamina * 100 + '%'; st.style.background = me.sprintLocked ? '#e5533d' : '#4de683';
    $('charge-wrap').style.visibility = me.charging ? 'visible' : 'hidden';
    $('charge').style.width = me.charge * 100 + '%';
    $('zone').style.display = m.cfg.timing ? 'block' : 'none';
  }
  const withBall = me && m.ball.owner === me;
  const A = $('btnA'), B = $('btnB');
  setBtn('btnS', 'sprint', L('btn.sprint'));
  setBtn('btnA', withBall ? 'shoot' : 'defend', L(withBall ? 'btn.shoot' : 'btn.defend'));
  setBtn('btnB', withBall ? 'pass' : 'switch', L(withBall ? 'btn.pass' : 'btn.switch'));
  setBtn('btnD', 'dodge', L('btn.dodge')); $('btnD').classList.toggle('off', !withBall || (match.human && match.human.dodgeCd > 0));
  $('btnS').classList.toggle('off', !!(me && me.sprintLocked));
  // possession: arrow under the team in possession, flash on change
  const ot = m.ball.owner ? m.ball.owner.team : lastOwnerTeam;
  if (ot !== lastOwnerTeam && ot >= 0) {
    for (const [i, id] of [[0, 'home-chip'], [1, 'away-chip']]) { const c = $(id); c.classList.toggle('has-ball', i === ot); if (i === ot && lastOwnerTeam >= 0) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } }
    lastOwnerTeam = ot;
  }
  $('shotclock').classList.toggle('low', m.shotClockLeft <= 5 && m.phase === 'LIVE');
  for (const i of [0, 1]) if (m.teams[i].score !== lastScore[i]) { lastScore[i] = m.teams[i].score; const el = $(i ? 'away-score' : 'home-score'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
  $('btnS').classList.toggle('on', !!(match.human && match.human.sprinting));
  if (toastT > 0) { toastT -= dt; $('toast').style.opacity = Math.min(1, toastT * 2); }
  if (timingT > 0) { timingT -= dt; if (timingT <= 0) $('timing').textContent = ''; }
  const info = new URLSearchParams(location.search).has('debug') ? ` · ${renderer.info.render.calls} dc · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tri` : '';
  $('info').textContent = `${L('hud.prototype')} · ${tier} · ${fpsAvg.toFixed(0)} fps${info}`;
}

let lastW = 0, lastH = 0;
function resize() {
  const w = LW(), h = LH(); if (w === lastW && h === lastH) return;
  lastW = w; lastH = h; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  vfx.setScale(h * Math.min(devicePixelRatio, preset.pixelRatio));
}

// ------------------------------------------------------------------ 3D portraits (player cards)
// The real 3D model of the player (same seed = same face, hair and body as in the match), rendered
// once off screen as a head-and-shoulders bust, cached as an image.
const portraitCache = new Map();
let portraitRig = null;
function portraitFor(p, kits) {
  const own = !kits || typeof kits !== 'object', K = own ? state.data.club.kits : kits;
  const key = `${p.id}|${JSON.stringify(K.home)}|${own ? state.equippedColor('cap') : ''}|${p.number}|5`;
  if (portraitCache.has(key)) return portraitCache.get(key);
  if (!portraitRig) {
    const sc = new THREE.Scene();
    sc.environment = scene.environment;
    sc.add(new THREE.HemisphereLight(0xdfeeff, 0x1d6c96, 0.45));
    const k = new THREE.DirectionalLight(0xfff1de, 1.25); k.position.set(1.2, 2, 2.5); sc.add(k);
    const rim = new THREE.DirectionalLight(0x8fd0ff, 1.6); rim.position.set(-2, 1.5, -2); sc.add(rim);
    const rt = new THREE.WebGLRenderTarget(160, 200, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 200;
    portraitRig = { sc, rt, cam: new THREE.PerspectiveCamera(24, 160 / 200, 0.05, 10), cv, buf: new Uint8Array(160 * 200 * 4) };
  }
  const R = portraitRig, look = lookOf(p), gk = p.role === 'GOALKEEPER';
  const a = new Athlete({ ...kitOptions(K.home, K.goalkeeper, gk, own), number: p.number,
    role: p.role, bodyRole: look.role, isGK: gk, seed: look.seed, preset: { ...PRESETS.ULTRA } });
  a.root.position.y = 0.25; R.sc.add(a.root);
  const st = { x: 0, z: 0, fx: 0, fz: 1, vx: 0, vz: 0, hasBall: false, charging: false, charge: 0, block: 0, stamina: 1, ball: new THREE.Vector3(0, 0.6, 3), receive: false };
  for (let i = 0; i < 30; i++) a.update(1 / 30, st);
  a.root.updateMatrixWorld(true);
  const h = a.head.getWorldPosition(new THREE.Vector3());
  R.cam.position.set(h.x + 0.1, h.y + 0.16, h.z + 1.05); R.cam.lookAt(h.x, h.y + 0.07, h.z);   // head bone = neck pivot: the face is ~0.1 m above
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  renderer.setRenderTarget(R.rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(R.sc, R.cam);
  renderer.readRenderTargetPixels(R.rt, 0, 0, 160, 200, R.buf);
  renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA);
  R.sc.remove(a.root); a.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  const g = R.cv.getContext('2d'), img = g.createImageData(160, 200);
  for (let y = 0; y < 200; y++) img.data.set(R.buf.subarray((199 - y) * 640, (200 - y) * 640), y * 640);   // flip Y
  g.putImageData(img, 0, 0);
  const url = R.cv.toDataURL('image/png');
  portraitCache.set(key, url);
  return url;
}

// ------------------------------------------------------------------ game state + front-end
const state = new GameState();
let heroVisible = true;
// Settings rows: [label key, value text, key, tab, type ('list' | 'toggle' | 'slider'), index, count]
const onOff = (v) => L(v ? 'value.on' : 'value.off');
const settingsDef = () => [
  ['menu.camera', `${CAMERAS.indexOf(opts.camera) + 1}. ${L('cam.' + opts.camera.toLowerCase())}`, 'camera', 'match', 'list', CAMERAS.indexOf(opts.camera), CAMERAS.length],
  ['menu.zoom', String(opts.zoom ?? 5), 'zoom', 'match', 'slider', (opts.zoom ?? 5) - 1, 10],
  ['menu.duration', L('menu.quarter', opts.minutes), 'minutes', 'match', 'list', MINUTES.indexOf(opts.minutes), MINUTES.length],
  ['menu.difficulty', L(DIFF_KEYS[opts.difficulty]), 'difficulty', 'match', 'list', opts.difficulty, 3],
  ['menu.radar', onOff(opts.radar !== false), 'radar', 'match', 'toggle'],
  ['menu.replays', onOff(opts.replays), 'replays', 'match', 'toggle'],
  ['menu.intro', onOff(opts.intro !== false), 'intro', 'match', 'toggle'],
  ['menu.lineups', onOff(opts.lineups !== false), 'lineups', 'match', 'toggle'],
  ['menu.assist', L('assist.' + opts.assist.toLowerCase()), 'assist', 'controls', 'list', ASSISTS.indexOf(opts.assist), ASSISTS.length],
  ['menu.timing', onOff(opts.timing), 'timing', 'controls', 'toggle'],
  ['menu.autoswitch', onOff(opts.autoSwitch !== false), 'autoSwitch', 'controls', 'toggle'],
  ['menu.haptics', onOff(opts.haptics !== false), 'haptics', 'controls', 'toggle'],
  ['menu.sound', onOff(opts.sound), 'sound', 'audio', 'toggle'],
  ['menu.ambience', L('amb.' + opts.ambience.toLowerCase()), 'ambience', 'audio', 'list', AMBIENCES.indexOf(opts.ambience), AMBIENCES.length],
  ['menu.graphics', opts.graphics === 'AUTO' ? `${L('graphics.auto')} (${autoTier})` : opts.graphics, 'graphics', 'graphics', 'list', GRAPHICS.indexOf(opts.graphics), GRAPHICS.length],
  ['menu.language', L('lang.name'), 'lang', 'other', 'list', LANGS.indexOf(lang), LANGS.length],
];
const step = (list, v, dir) => list[(list.indexOf(v) + dir + list.length) % list.length];
/** Changes a setting (dir = +1 next / -1 previous; value for sliders); applied at once, also during a match. */
async function changeSetting(key, dir = 1, value) {
  switch (key) {
    case 'graphics': opts.graphics = step(GRAPHICS, opts.graphics, dir); applyQuality(opts.graphics === 'AUTO' ? autoTier : opts.graphics); break;
    case 'camera': opts.camera = step(CAMERAS, opts.camera, dir); refreshChips(); break;
    case 'zoom': opts.zoom = Math.max(1, Math.min(10, value ?? (opts.zoom ?? 5) + dir)); break;
    case 'radar': opts.radar = opts.radar === false; break;
    case 'intro': opts.intro = opts.intro === false; break;
    case 'lineups': opts.lineups = opts.lineups === false; break;
    case 'haptics': opts.haptics = opts.haptics === false; break;
    case 'ambience': opts.ambience = step(AMBIENCES, opts.ambience, dir); arena.setAmbience(opts.ambience); break;
    case 'replays': opts.replays = !opts.replays; break;
    case 'difficulty': opts.difficulty = (opts.difficulty + dir + 3) % 3; if (match) match.cfg.cpu = DIFF[opts.difficulty]; break;
    case 'assist': opts.assist = step(ASSISTS, opts.assist, dir); if (match) match.cfg.assist = opts.assist; break;
    case 'minutes': {
      opts.minutes = step(MINUTES, opts.minutes, dir);
      if (match) { const k = match.periodLeft / match.cfg.periodDuration; match.cfg.periodDuration = opts.minutes * 60; match.periodLeft = k * match.cfg.periodDuration; }
      break;
    }
    case 'timing': opts.timing = !opts.timing; if (match) match.cfg.timing = opts.timing; break;
    case 'autoSwitch': opts.autoSwitch = opts.autoSwitch === false; if (match) match.cfg.autoSwitch = opts.autoSwitch; break;
    case 'sound': opts.sound = !opts.sound; audio.setEnabled(opts.sound); refreshChips(); break;
    case 'lang': lang = step(LANGS, lang, dir); await loadLang(lang); lastWho = null; break;
  }
  saveOpts();
}
const app = new App($('app'), {
  L, state,
  setHero: (v, name) => { heroVisible = v; if (name !== 'prematch') clearPrematch(); },
  refreshBall: () => setBall(state.data.club.ball || 'classic'),
  prematch: (opp, pref) => { if (!pmView || pmView.key !== opp + '|' + pref) buildPrematch(opp, pref); },
  portrait: (p, capColor) => { try { return portraitFor(p, capColor); } catch (e) { console.warn('portrait', e); return null; } },
  refreshHero: () => buildHero(),
  // club editor: live 3D preview of a draft identity (null = back to the saved club)
  preview: (club, view = 'home') => { heroPreview = club ? { club, view } : null; if (!club) heroYaw = 0; buildHero(); },
  previewPlayer: (p) => { heroPreview = { club: state.data.club, view: 'home', player: p }; heroYaw = 0; buildHero(); },
  rotateHero: (d) => { heroYaw += d; },
  startMatch: (ctx) => {
    const el = document.documentElement;
    if (el.requestFullscreen && matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    lockLandscape(); audio.start(); startMatch(ctx);
  },
  settingsRows: () => settingsDef().map(([k, ...rest]) => [L(k), ...rest]),
  changeSetting: (key, dir, value) => changeSetting(key, dir, value),
  haptic: (p) => { if (navigator.vibrate) navigator.vibrate(p); },
  uiSound: () => { audio.start(); audio.tone(880, 0.05, 0.05, 'sine'); },
  rewardSound: () => { audio.tone(660, 0.12, 0.12, 'triangle'); setTimeout(() => audio.tone(990, 0.2, 0.12, 'triangle'), 110); },
});

// ------------------------------------------------------------------ showcase (?showcase): close-up check of models & animations
let showcase = null;
function buildShowcase() {
  const states = ['tread', 'swim', 'hold', 'wind', 'gk', 'celebrate'];
  window.__showcase = () => showcase;
  showcase = states.map((st, i) => {
    const a = new Athlete({ teamColor: i % 2 ? 0xd8321e : 0x1e5bd8, capColor: st === 'gk' ? 0xd81a1f : i % 2 ? 0xf2f4f7 : 0x1e5bd8, trimColor: 0xffffff,
      number: i + 2, role: ['CENTER', 'WINGER', 'FINISHER', 'PLAYMAKER', 'GOALKEEPER', 'DEFENDER'][i], isGK: st === 'gk', seed: 11 + i * 17, preset });
    const x = (i - 2.5) * 0.85;
    a.showcaseState = (t) => {
      if (st === 'celebrate' && a.celebrateT <= 0) a.playCelebrate('arms');
      // wind-up 1.5 s, then the shot is released (whole kinetic chain), every 2.4 s
      const cyc = (t % 2.4), charging = st === 'wind' && cyc < 1.5;
      if (st === 'wind' && !charging && a.throwT <= 0 && !a._thrown) { a.playThrow('shot'); a._thrown = true; }
      if (charging) a._thrown = false;
      return { x, z: 0, fx: 0, fz: -1, vx: st === 'swim' ? 0 : 0, vz: st === 'swim' ? -1.5 : 0, sprint: false, hasBall: st === 'hold' || charging || (st === 'swim' && new URLSearchParams(location.search).has('dribble')), charging,
        charge: Math.min(1, cyc / 1.2), block: 0, stamina: 1, ball: new THREE.Vector3(x, 1, -3), receive: false };
    };
    scene.add(a.root); return a;
  });
  app.hide();
}

// ------------------------------------------------------------------ boot
updateOrientationGate();   // landscape layout before the first frame
(async () => {
  await Promise.all([loadLang('en'), loadLang(lang), loadScanHead().catch((e) => console.warn('scan head', e)), loadScanBody().catch((e) => console.warn('scan body', e)), loadAnimations().catch((e) => console.warn('animations', e))]);
  applyQuality(tier);
  setupInput();
  addEventListener('pointerdown', () => { lockLandscape(); audio.start(); }, { once: true });
  $('pause-resume').onclick = closePause;
  $('skipBtn').onclick = () => skipPresentation();   // line-ups (match paused) / goal card: tap or click
  if (state.data.clubChosen) app.home(); else app.show('clubs', { first: true }, false);   // first launch: CHOISIS TON CLUB
  $('tactic').onclick = (e) => { if (e.detail !== 0 || e.pointerType) return; openTactics(false); };
  if (new URLSearchParams(location.search).has('showcase')) buildShowcase();
  requestAnimationFrame(frame);
  requestAnimationFrame(() => { const sp = $('splash'); sp.classList.add('done'); setTimeout(() => sp.remove(), 600); });
})();
