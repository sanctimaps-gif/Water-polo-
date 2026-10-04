// WATER POLO 26 MOBILE — web build of the match simulation.
// Faithful JavaScript port of WaterPolo26Mobile/Assets/_Project/Scripts/Simulation (C#).
// Coordinates: Y up, water surface Y = 0, pool length along X (goals at ±X), width along Z.

// ---------------------------------------------------------------- math
export const V = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, s) => V(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.sqrt(dot(a, a));
const flat = (a) => V(a.x, 0, a.z);
const norm = (a) => { const m = len(a); return m > 1e-6 ? mul(a, 1 / m) : V(); };
const fdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dist = (a, b) => len(sub(a, b));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * clamp01(t);
const invLerp = (a, b, v) => (Math.abs(b - a) < 1e-6 ? 0 : clamp01((v - a) / (b - a)));
const vlerp = (a, b, t) => { t = clamp01(t); return V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); };
const clampMag = (v, m) => { const l = len(v); return l <= m ? v : mul(v, m / l); };
const moveTowards = (c, t, d) => { const v = sub(t, c); const l = len(v); return l <= d || l < 1e-6 ? t : add(c, mul(v, d / l)); };
const DEG = Math.PI / 180;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const rotateFlatTowards = (from, to, maxRad) => {
  const a = Math.atan2(from.z, from.x), b = Math.atan2(to.z, to.x);
  const r = a + clamp(wrap(b - a), -maxRad, maxRad);
  return V(Math.cos(r), 0, Math.sin(r));
};
const distToSegment = (p, a, b) => {
  const ab = flat(sub(b, a)), ap = flat(sub(p, a));
  const l2 = dot(ab, ab);
  const t = l2 > 1e-6 ? clamp01(dot(ap, ab) / l2) : 0;
  const c = add(flat(a), mul(ab, t));
  return { d: len(sub(flat(p), c)), t };
};

export class Rng {
  constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; for (let i = 0; i < 8; i++) this.u(); }
  u() { let x = this.s; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; this.s = x; return x; }
  f() { return (this.u() >>> 8) / 16777216; }
  range(a, b) { return a + (b - a) * this.f(); }
  chance(p) { return this.f() < p; }
  bell() { return (this.f() + this.f() + this.f()) * (2 / 3) - 1; }
}

// ---------------------------------------------------------------- data
export const Role = { GK: 'GOALKEEPER', CENTER: 'CENTER', DEF: 'DEFENDER', WING: 'WINGER', PLAY: 'PLAYMAKER', FIN: 'FINISHER', ALL: 'ALL_ROUNDER' };
const PERSONALITY = {
  LEADER: { shoot: -0.05, risk: 1.05, patience: 1, aggr: 1.1, passPref: 0.05 },
  CREATIVE: { shoot: 0, risk: 1.35, patience: 0.9, aggr: 0.9, passPref: 0.1 },
  CALM: { shoot: 0.05, risk: 0.8, patience: 1.3, aggr: 0.7, passPref: 0.05 },
  AGGRESSIVE: { shoot: -0.08, risk: 1.1, patience: 0.75, aggr: 1.6, passPref: -0.05 },
  TEAM_PLAYER: { shoot: 0.08, risk: 0.95, patience: 1, aggr: 1, passPref: 0.2 },
  TACTICAL: { shoot: 0.03, risk: 0.85, patience: 1.15, aggr: 0.9, passPref: 0.1 },
  RISK_TAKER: { shoot: -0.12, risk: 1.5, patience: 0.7, aggr: 1.2, passPref: -0.1 },
};
const STATS = ['speed', 'accel', 'stamina', 'passing', 'shooting', 'power', 'accuracy', 'defense', 'reaction', 'positioning', 'technique', 'intelligence', 'physical', 'goalkeeping'];
export const N = (s) => (Math.max(1, Math.min(99, s)) - 1) / 98;

export const TACTICS = ['BALANCED', 'FAST', 'OFFENSIVE', 'DEFENSIVE', 'PRESSURE', 'CENTER', 'COUNTER'];
export function tacticParams(style) {
  const t = { depth: 1, width: 1, tempo: 1, shoot: 0, mark: 1.1, zone: 0.15, center: 0.15, trans: 0.5, press: 1, safety: 0, denial: 0.15 };
  switch (style) {
    case 'FAST': Object.assign(t, { tempo: 0.6, trans: 0.85, shoot: -0.04 }); break;
    case 'OFFENSIVE': Object.assign(t, { depth: 1.15, shoot: -0.1, zone: 0.05, mark: 1.3 }); break;
    case 'DEFENSIVE': Object.assign(t, { depth: 0.85, shoot: 0.08, zone: 0.65, mark: 1.2, denial: 0, tempo: 1.25, press: 0.7, safety: 1 }); break;
    case 'PRESSURE': Object.assign(t, { mark: 0.8, press: 1.6, zone: 0.15, trans: 0.7, denial: 0.5 }); break;
    case 'CENTER': Object.assign(t, { center: 0.6, width: 1.15, tempo: 1.1 }); break;
    case 'COUNTER': Object.assign(t, { trans: 1, tempo: 0.75, zone: 0.35, shoot: -0.03 }); break;
  }
  return t;
}

export function makeTeam(id, name, short, color, rating, seed) {
  const rng = new Rng(seed);
  const R = (b) => Math.max(20, Math.min(99, rating + b + Math.floor(rng.range(-6, 7))));
  const defs = [
    [`${short} GK`, 1, Role.GK, 'CALM', -1], [`${short} RW`, 2, Role.WING, 'RISK_TAKER', 0], [`${short} RF`, 3, Role.FIN, 'AGGRESSIVE', 1],
    [`${short} PT`, 4, Role.PLAY, 'LEADER', 2], [`${short} LF`, 5, Role.DEF, 'TACTICAL', 3], [`${short} LW`, 6, Role.WING, 'CREATIVE', 4],
    [`${short} CF`, 7, Role.CENTER, 'TEAM_PLAYER', 5],
  ];
  const players = defs.map(([n, num, role, pers, slot]) => {
    const s = {};
    for (const k of STATS) s[k] = R(0);
    s.goalkeeping = R(-45);
    if (role === Role.GK) Object.assign(s, { goalkeeping: R(8), reaction: R(6), positioning: R(5), shooting: R(-30), speed: R(-10) });
    if (role === Role.CENTER) Object.assign(s, { physical: R(12), power: R(6), speed: R(-6), technique: R(4) });
    if (role === Role.DEF) Object.assign(s, { defense: R(10), physical: R(6), positioning: R(5), shooting: R(-6) });
    if (role === Role.WING) Object.assign(s, { speed: R(8), accel: R(8), accuracy: R(4) });
    if (role === Role.PLAY) Object.assign(s, { passing: R(10), intelligence: R(10), technique: R(5) });
    if (role === Role.FIN) Object.assign(s, { shooting: R(10), power: R(8), accuracy: R(6) });
    return { name: n, number: num, role, personality: pers, stats: s, slot };
  });
  return { id, name, short, color, tactic: 'BALANCED', players };
}
export const HOME = () => makeTeam('riviera', 'Riviera Dolphins', 'RIV', 0x1e5bd8, 72, 101);
export const AWAY = () => makeTeam('northshore', 'Northshore Orcas', 'NOR', 0xd8321e, 70, 202);

// ---------------------------------------------------------------- constants
const BALL_R = 0.11, HOLD_H = 0.45, G = 9.81;
export const CHARGE_TIME = 0.9, EXC_MIN = 0.72, EXC_MAX = 0.86;
const ATT_D = [2.6, 5.2, 7.0, 5.2, 2.6, 2.0], ATT_Z = [-4.6, -3.0, 0, 3.0, 4.6, 0];

export const Ev = {
  PERIOD_START: 'PeriodStart', SWIM_OFF: 'SwimOff', POSSESSION: 'PossessionWon', PASS: 'PassMade', PASS_OK: 'PassCompleted',
  INTERCEPT: 'PassIntercepted', SHOT: 'ShotTaken', SAVE: 'ShotSaved', BLOCK: 'ShotBlocked', OFF: 'ShotOffFrame', FRAME: 'ShotHitFrame',
  GOAL: 'Goal', STEAL: 'Steal', FOUL: 'Foul', OUT: 'BallOut', SHOT_CLOCK: 'ShotClockViolation', RESTART: 'Restart',
  PERIOD_END: 'PeriodEnd', END: 'MatchEnd', SWITCH: 'HumanPlayerSwitched',
};

// ---------------------------------------------------------------- simulation
export class Match {
  constructor(cfg, home, away) {
    this.cfg = Object.assign({
      length: 25, width: 20, goalW: 3, goalH: 0.9, goalDepth: 0.4, periodDuration: 120, periods: 4, shotClock: 30, shotClockRebound: 20,
      goalPause: 3, deadPause: 1.2, periodBreak: 3, dt: 1 / 50, seed: 12345, humanTeam: 0, autoSwitch: true, assist: 'STANDARD', timing: true, cpu: 1,
    }, cfg);
    const c = this.cfg; c.hl = c.length / 2; c.hw = c.width / 2;
    this.rng = new Rng(c.seed);
    this.time = 0; this.tick = 0; this.events = [];
    this.players = []; this.teams = [];
    [home, away].forEach((def, ti) => {
      const team = { index: ti, def, players: [], field: [], gk: null, score: 0, tactic: def.tactic, tp: tacticParams(def.tactic) };
      for (const pd of def.players) {
        const p = {
          id: this.players.length, team: ti, number: pd.number, name: pd.name, role: pd.role, isGK: pd.role === Role.GK,
          prof: PERSONALITY[pd.personality], stats: pd.stats, slot: pd.role === Role.GK ? -1 : pd.slot,
          pos: V(), vel: V(), facing: V(1, 0, 0), stamina: 1, sprinting: false, sprintLocked: false, human: false, cmd: {},
          charge: 0, charging: false, heldAtMax: 0, actionCd: 0, stealCd: 0, stun: 0, block: 0, possTime: 0, nextDecision: 0, wantSprint: false, aiCharge: -1,
        };
        this.players.push(p); team.players.push(p);
        if (p.isGK) team.gk = p; else team.field.push(p);
      }
      this.teams.push(team);
    });
    this.ball = { pos: V(0, BALL_R, 0), vel: V(), state: 'FREE', owner: null, lastTouch: null, passer: null, receiver: null, shooter: null, possTeam: -1, stateTime: 0, saveDone: false, tried: new Set() };
    this.stats = { teams: [0, 1].map(() => ({ goals: 0, shots: 0, onTarget: 0, passes: 0, passesOk: 0, saves: 0, interceptions: 0, steals: 0, blocks: 0, fouls: 0, possession: 0 })) };
    this.phase = 'NOT_STARTED'; this.period = 0; this.periodLeft = 0; this.shotClockLeft = 0; this.phaseTimer = 0;
    this.restart = null; this.humanCmd = {}; this.human = null; this.assistCand = [null, null];
    if (c.humanTeam === 0 || c.humanTeam === 1) this.setHuman(this.slot(c.humanTeam, 2), false);
  }

  // --- helpers
  slot(team, s) { return this.teams[team].field.find((p) => p.slot === s) || this.teams[team].field[0]; }
  ownGoal(t) { return V(t === 0 ? -this.cfg.hl : this.cfg.hl, 0, 0); }
  targetGoal(t) { return this.ownGoal(1 - t); }
  sign(t) { return t === 0 ? 1 : -1; }
  isHuman(p) { return p && p.human; }
  skill(t) { return this.cfg.humanTeam >= 0 && t !== this.cfg.humanTeam ? this.cfg.cpu : 1; }
  emit(type, team, player = -1, other = -1, pos = V(), value = 0) { this.events.push({ type, team, player, other, pos: { ...pos }, value, time: this.time }); }
  drain() { const e = this.events; this.events = []; return e; }
  get finished() { return this.phase === 'ENDED'; }
  get possessionTeam() { return this.ball.owner ? this.ball.owner.team : this.ball.possTeam; }

  fatSpeed(p) { return lerp(0.75, 1, p.stamina); }
  fatSkill(p) { return lerp(0.8, 1, p.stamina); }
  effPass(p) { return N(p.stats.passing) * this.fatSkill(p); }
  effAcc(p) { return N(p.stats.accuracy) * this.fatSkill(p); }
  effShoot(p) { return N(p.stats.shooting) * this.fatSkill(p); }
  effPower(p) { return N(p.stats.power) * lerp(0.85, 1, p.stamina); }
  effDef(p) { return N(p.stats.defense) * this.fatSkill(p); }
  reactionTime(p) { return lerp(0.42, 0.12, N(p.stats.reaction)) / lerp(0.8, 1, p.stamina); }

  closestOpp(p) {
    let best = null, d = 1e9;
    for (const o of this.teams[1 - p.team].players) { const x = fdist(o.pos, p.pos); if (x < d) { d = x; best = o; } }
    return { p: best, d };
  }
  pressure(p) { const { d } = this.closestOpp(p); return d < 1.6 ? (1.6 - d) / 1.6 : 0; }
  closestPlayer(team, pt, gk) {
    let best = null, d = 1e9;
    for (const p of this.teams[team].players) { if (p.isGK && !gk) continue; const x = fdist(p.pos, pt); if (x < d) { d = x; best = p; } }
    return best;
  }
  amongClosest(p, n, any = false) {
    const mine = fdist(p.pos, this.ball.pos); let closer = 0;
    for (const o of this.players) {
      if (o === p || (!any && (o.team !== p.team || o.isGK))) continue;
      const d = fdist(o.pos, this.ball.pos);
      if (d < mine || (d === mine && o.id < p.id)) closer++;
      if (closer >= n) return false;
    }
    return true;
  }
  laneBlocked(a, b) { return this.teams[1 - a.team].players.some((o) => { const r = distToSegment(o.pos, a.pos, b.pos); return r.t > 0.1 && r.t < 0.9 && r.d < 1; }); }

  // --- human API
  setHumanCommand(cmd) {
    const h = this.humanCmd;
    const merged = Object.assign({}, cmd);
    for (const k of ['pass', 'shootReleased', 'quickShot', 'defend', 'hasAim', 'lobShot']) merged[k] = !!(h[k] || cmd[k]);
    if (!cmd.pass && h.pass) { merged.passDir = h.passDir; merged.lob = h.lob; }
    if (!cmd.hasAim && h.hasAim) { merged.aimX = h.aimX; merged.aimY = h.aimY; }
    this.humanCmd = merged;
  }
  setHuman(p, emit) {
    if (this.human === p) return;
    if (this.human) { this.human.human = false; this.human.charging = false; this.human.charge = 0; }
    this.human = p; p.human = true; this.humanCmd = {}; this.lastSwitch = this.time;
    if (emit) this.emit(Ev.SWITCH, p.team, p.id);
  }
  switchHuman() {
    if (!this.human) return;
    const team = this.teams[this.human.team];
    if (this.ball.owner && this.ball.owner.team === team.index) { if (!this.ball.owner.isGK) this.setHuman(this.ball.owner, true); return; }
    let best = null, bs = 1e9; const og = this.ownGoal(team.index);
    for (const p of team.field) {
      if (p === this.human) continue;
      const s = fdist(p.pos, this.ball.pos) + (fdist(p.pos, og) < fdist(this.ball.pos, og) ? 0 : 1.5);
      if (s < bs) { bs = s; best = p; }
    }
    if (best) this.setHuman(best, true);
  }
  /** Automatic switch: the controlled player follows the ball (loose ball, opponent attack, own pass in flight). */
  autoSwitch() {
    const h = this.human; if (!h || !this.cfg.autoSwitch) return;
    const b = this.ball, team = this.teams[h.team];
    if (this.time - this.lastSwitch < 0.6) return;
    if (b.owner) { if (b.owner.team === h.team) return; }
    else if (b.state === 'PASSED' && b.possTeam === h.team) {
      if (b.receiver && b.receiver !== h && !b.receiver.isGK) { this.setHuman(b.receiver, true); this.lastSwitch = this.time; }
      return;
    } else if (b.state === 'SHOT' && b.possTeam === h.team) return;
    // Defensive/loose ball: the field player best placed to act on the ball (or the receiver of an opponent pass).
    const target = !b.owner && b.state === 'PASSED' && b.receiver ? b.receiver.pos : b.pos, og = this.ownGoal(h.team);
    const score = (p) => fdist(p.pos, target) + (fdist(p.pos, og) <= fdist(target, og) + 0.5 ? 0 : 2);
    let best = null, bs = 1e9;
    for (const p of team.field) { const s = score(p); if (s < bs) { bs = s; best = p; } }
    if (best && best !== h && bs < score(h) - 1.5) { this.setHuman(best, true); this.lastSwitch = this.time; }
  }
  setTactic(team, style) { this.teams[team].tactic = style; this.teams[team].tp = tacticParams(style); }

  // --- formation
  attackSpot(team, slot, tp) {
    slot = clamp(slot, 0, 5); const c = this.cfg;
    const z = clamp(ATT_Z[slot] * tp.width, -c.hw + 1, c.hw - 1);
    return V(this.targetGoal(team).x - this.sign(team) * ATT_D[slot] / Math.max(0.5, tp.depth), 0, z);
  }

  // =============================================================== step
  start() { this.period = 1; this.beginPeriod(); }

  step() {
    const dt = this.cfg.dt;
    this.time += dt; this.tick++;
    if (this.phase === 'NOT_STARTED') this.start();
    if (this.phase === 'ENDED') return;
    this.rulesTick(dt);
    if (this.phase !== 'LIVE') {
      for (const p of this.players) this.motor(p, V(), false, this.ball.owner === p, dt);
      this.spacing();
      if (this.ball.owner) this.snap();
      this.consumeOneShots();
      return;
    }
    this.autoSwitch();
    for (const p of this.players) {
      // Copy (C# PlayerCommand is a struct): consumeOneShots() below must not wipe this tick's actions.
      if (p.human) p.cmd = { ...this.humanCmd };
      else if (p.isGK) this.thinkGK(p);
      else this.thinkField(p);
    }
    this.consumeOneShots();
    for (const p of this.players) { this.apply(p, dt); if (this.phase !== 'LIVE') return; }
    this.spacing();
    const b = this.ball;
    if (b.owner) { this.snap(); b.owner.possTime += dt; }
    else {
      const prev = { ...b.pos };
      this.integrate(dt);
      this.resolveGK();
      if (!b.owner) this.boundaries(prev);
      if (this.phase === 'LIVE' && !b.owner) this.contacts();
      if (!b.owner) this.settle();
    }
    if (b.possTeam >= 0) this.stats.teams[b.possTeam].possession += dt;
  }
  consumeOneShots() { const h = this.humanCmd; h.pass = h.shootReleased = h.quickShot = h.defend = h.hasAim = h.lobShot = false; }

  // =============================================================== rules
  rulesTick(dt) {
    const c = this.cfg;
    if (this.phase === 'LIVE') {
      this.periodLeft -= dt;
      if (this.ball.possTeam >= 0) {
        this.shotClockLeft -= dt;
        if (this.shotClockLeft <= 0) {
          const off = this.ball.possTeam;
          this.emit(Ev.SHOT_CLOCK, off, -1, -1, this.ball.pos);
          this.restart = { team: 1 - off, pos: flat(this.ball.pos) };
          this.deadBall(); return;
        }
      }
      if (this.periodLeft <= 0) { this.periodLeft = 0; this.endPeriod(); }
    } else if (this.phase === 'GOAL_PAUSE' || this.phase === 'DEAD') {
      this.phaseTimer -= dt; if (this.phaseTimer <= 0) this.executeRestart();
    } else if (this.phase === 'BREAK') {
      this.phaseTimer -= dt; if (this.phaseTimer <= 0) { this.period++; this.beginPeriod(); }
    }
  }
  resetAction(p) { p.charge = 0; p.charging = false; p.heldAtMax = 0; p.actionCd = 0; p.stun = 0; p.block = 0; p.possTime = 0; p.aiCharge = -1; p.sprinting = false; }
  beginPeriod() {
    const c = this.cfg;
    this.periodLeft = c.periodDuration; this.shotClockLeft = c.shotClock;
    for (const t of this.teams) for (const p of t.players) {
      p.pos = V(this.ownGoal(t.index).x + this.sign(t.index) * 0.6, 0, p.slot < 0 ? 0 : -5 + p.slot * 2);
      p.vel = V(); p.facing = V(this.sign(t.index), 0, 0); this.resetAction(p);
    }
    const b = this.ball;
    Object.assign(b, { owner: null, lastTouch: null, possTeam: -1, pos: V(0, BALL_R, 0), vel: V() });
    this.setBall('FREE');
    this.phase = 'LIVE';
    this.emit(Ev.PERIOD_START, -1, -1, -1, V(), this.period);
    this.emit(Ev.SWIM_OFF, -1, -1, -1, V(), this.period);
  }
  endPeriod() {
    this.emit(Ev.PERIOD_END, -1, -1, -1, this.ball.pos, this.period);
    if (this.period >= this.cfg.periods) {
      this.phase = 'ENDED';
      const [a, b] = [this.teams[0].score, this.teams[1].score];
      this.emit(Ev.END, a === b ? -1 : a > b ? 0 : 1);
      return;
    }
    this.phase = 'BREAK'; this.phaseTimer = this.cfg.periodBreak;
  }
  onGoal(team) {
    this.teams[team].score++;
    this.phase = 'GOAL_PAUSE'; this.phaseTimer = this.cfg.goalPause;
    this.restart = { team: 1 - team, pos: V(), afterGoal: true };
  }
  onOut(result, side, pos) {
    const b = this.ball, c = this.cfg;
    const last = b.lastTouch ? b.lastTouch.team : b.possTeam >= 0 ? b.possTeam : 0;
    if (result === 'OUT_GOAL') {
      const def = side, lineX = def === 1 ? c.hl : -c.hl, inward = def === 1 ? -1 : 1;
      if (last === def) this.restart = { team: 1 - def, pos: V(lineX + inward * 2, 0, (pos.z >= 0 ? 1 : -1) * (c.hw - 0.8)) };
      else this.restart = { team: def, pos: V(lineX + inward, 0, 0), goalThrow: true };
    } else {
      this.restart = { team: 1 - last, pos: V(clamp(pos.x, -c.hl + 2, c.hl - 2), 0, (pos.z >= 0 ? 1 : -1) * (c.hw - 0.8)) };
    }
    this.deadBall();
  }
  onFoul(fouled) { this.restart = { team: fouled.team, pos: { ...fouled.pos }, taker: fouled }; this.phase = 'DEAD'; this.phaseTimer = 0.5; }
  deadBall() {
    const b = this.ball;
    if (b.owner) { b.lastTouch = b.owner; b.owner = null; }
    b.vel = V(); this.setBall('OUT');
    this.phase = 'DEAD'; this.phaseTimer = this.cfg.deadPause;
  }
  executeRestart() {
    const r = this.restart, team = this.teams[r.team], c = this.cfg;
    let taker;
    if (r.afterGoal) {
      const lat = [-6, -3.5, 0, 3.5, 6, 0], dep = [3, 4, 6, 4, 3, 2];
      for (const t of this.teams) for (const p of t.players) {
        const s = this.sign(t.index);
        p.pos = p.slot < 0 ? add(this.ownGoal(t.index), V(s, 0, 0)) : V(-s * dep[p.slot], 0, lat[p.slot]);
        p.vel = V(); p.facing = V(s, 0, 0); this.resetAction(p);
      }
      taker = this.slot(team.index, 2); taker.pos = V(-this.sign(team.index) * 0.5, 0, 0);
    } else if (r.taker) taker = r.taker;
    else if (r.goalThrow) { taker = team.gk; taker.pos = r.pos; }
    else { taker = this.closestPlayer(team.index, r.pos, false); taker.pos = r.pos; }
    taker.vel = V(); taker.actionCd = 0.3;
    for (const p of team.players) p.possTime = 0;
    this.give(taker, false);
    this.shotClockLeft = c.shotClock; this.phase = 'LIVE';
    this.emit(Ev.RESTART, team.index, taker.id, -1, taker.pos);
  }

  // =============================================================== locomotion
  maxSpeed(p, hasBall) {
    let s = lerp(1.15, 1.65, N(p.stats.speed)) * this.fatSpeed(p);
    if (p.sprinting) s *= 1.35;
    if (hasBall) s *= lerp(0.82, 0.92, N(p.stats.technique));
    return s;
  }
  motor(p, move, wantSprint, hasBall, dt) {
    move = clampMag(flat(move), 1); const amt = len(move);
    // stamina
    if (p.sprintLocked && p.stamina >= 0.2) p.sprintLocked = false;
    p.sprinting = wantSprint && amt > 0.2 && !p.sprintLocked && p.stamina > 0.03;
    if (p.sprinting) {
      p.stamina -= lerp(0.085, 0.045, N(p.stats.stamina)) * dt;
      if (p.stamina <= 0.03) { p.stamina = Math.max(0, p.stamina); p.sprintLocked = true; p.sprinting = false; }
    } else p.stamina = Math.min(1, p.stamina + lerp(0.03, 0.065, N(p.stats.stamina)) * lerp(1, 0.35, amt) * dt);
    let max = this.maxSpeed(p, hasBall); if (p.stun > 0) max *= 0.35;
    const desired = mul(move, max);
    let acc = lerp(1.6, 3.6, N(p.stats.accel)) * (p.sprinting ? 1.2 : 1);
    if (dot(desired, p.vel) < 0) acc *= 0.75;
    if (amt < 0.05) acc = 2.2;
    p.vel = moveTowards(flat(p.vel), desired, acc * dt);
    p.pos = add(p.pos, mul(p.vel, dt)); p.pos.y = 0;
    const turn = lerp(200, 420, N(p.stats.technique)) * DEG;
    p.facing = rotateFlatTowards(p.facing, amt > 0.1 ? norm(move) : p.facing, turn * dt);
  }
  faceTo(p, pt, dt) { const d = flat(sub(pt, p.pos)); if (dot(d, d) > 1e-4) p.facing = rotateFlatTowards(p.facing, norm(d), lerp(200, 420, N(p.stats.technique)) * DEG * dt); }
  clampField(p) {
    const c = this.cfg;
    p.pos.x = clamp(p.pos.x, -c.hl + 0.3, c.hl - 0.3); p.pos.z = clamp(p.pos.z, -c.hw + 0.3, c.hw - 0.3);
    if (p.isGK) p.pos.x = p.team === 0 ? Math.min(p.pos.x, 0) : Math.max(p.pos.x, 0);
  }
  spacing() {
    const P = this.players;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j]; const d = flat(sub(b.pos, a.pos)); const l = len(d);
      if (l >= 0.75) continue;
      const n = l > 1e-4 ? mul(d, 1 / l) : V(1, 0, 0);
      const wa = 0.5 + (N(b.stats.physical) - N(a.stats.physical)) * 0.3, push = 0.75 - l;
      a.pos = sub(a.pos, mul(n, push * wa)); b.pos = add(b.pos, mul(n, push * (1 - wa)));
    }
    for (const p of P) this.clampField(p);
    if (this.ball.owner) this.snap();
  }

  // =============================================================== commands
  apply(p, dt) {
    const cmd = p.cmd || {}; let hasBall = this.ball.owner === p;
    if (p.actionCd > 0) p.actionCd -= dt; if (p.stealCd > 0) p.stealCd -= dt; if (p.stun > 0) p.stun -= dt; if (p.block > 0) p.block -= dt;
    if (hasBall && p.stun <= 0) {
      const tap = cmd.shootReleased && !cmd.shootHeld && !p.charging;
      if ((cmd.quickShot || tap) && p.actionCd <= 0) { this.takeShot(p, 0.45, 'NONE', cmd); hasBall = false; }
      else if (cmd.shootHeld && p.actionCd <= 0) {
        p.charging = true; p.charge = Math.min(1, p.charge + dt / CHARGE_TIME); if (p.charge >= 1) p.heldAtMax += dt;
      } else if (p.charging) {
        const q = this.cfg.timing && p.human ? timingQuality(p.charge, p.heldAtMax) : 'NONE';
        this.takeShot(p, Math.max(0.2, p.charge), q, cmd); hasBall = false;
      } else if (cmd.pass && p.actionCd <= 0) { this.doPass(p, cmd); hasBall = false; }
    } else if (!hasBall) {
      p.charging = false; p.charge = 0; p.heldAtMax = 0;
      if (cmd.defend && p.stun <= 0) this.doDefend(p);
    }
    const move = p.charging ? mul(cmd.move || V(), 0.35) : cmd.move || V();
    this.motor(p, move, !!cmd.sprint && !p.charging, hasBall, dt);
    if (p.charging) this.faceTo(p, this.targetGoal(p.team), dt);
    this.clampField(p);
  }
  takeShot(p, charge, q, cmd) { p.charging = false; p.charge = 0; p.heldAtMax = 0; p.aiCharge = -1; this.shoot(p, charge, q, cmd); }
  doPass(p, cmd) {
    const assist = p.human ? this.cfg.assist : 'STANDARD';
    const dir = cmd.passDir && len(cmd.passDir) > 0.1 ? cmd.passDir : p.human ? cmd.move || V() : V();
    const tp = this.teams[p.team].tp;
    this.passTo(p, this.chooseTarget(p, dir, assist, p.prof.risk, tp.center), dir, !!cmd.lob);
  }
  doDefend(p) {
    const c = this.ball.owner;
    if (c && c.team !== p.team && p.stealCd <= 0 && fdist(p.pos, c.pos) < 1.15) {
      const press = p.human ? 1 : this.teams[p.team].tp.press;
      p.stealCd = 1.2 / Math.max(0.5, press);
      const pS = clamp(0.12 + 0.4 * this.effDef(p) * this.skill(p.team) - 0.25 * N(c.stats.physical) - 0.1 * N(c.stats.technique), 0.04, 0.55);
      if (this.rng.chance(pS)) {
        this.stats.teams[p.team].steals++; this.emit(Ev.STEAL, p.team, p.id, c.id, c.pos); this.give(p, true); return;
      }
      const foul = 0.28 * p.prof.aggr * lerp(1.2, 0.8, N(p.stats.technique)) * lerp(0.8, 1.2, N(c.stats.physical));
      if (this.rng.chance(foul)) {
        this.stats.teams[p.team].fouls++; p.stun = 0.6;
        p.pos = add(p.pos, mul(norm(flat(sub(this.ownGoal(p.team), p.pos))), 0.5));
        this.emit(Ev.FOUL, p.team, p.id, c.id, c.pos); this.onFoul(c);
      }
      return;
    }
    if (p.block <= 0 && p.stealCd <= 0) { p.block = 0.6; p.stealCd = 0.9; }
  }

  // =============================================================== passes
  evaluate(passer, t, pref, assist, risk, centerBonus) {
    if (t === passer || t.team !== passer.team) return -Infinity;
    const to = flat(sub(t.pos, passer.pos)), d = len(to);
    if (d < 1.5) return -Infinity;
    const s = this.sign(passer.team), goal = this.targetGoal(passer.team);
    const advance = clamp((t.pos.x - passer.pos.x) * s / 10, -1, 1);
    const prox = 1 - clamp01(fdist(t.pos, goal) / 15);
    let lane = 0, rp = 0;
    for (const o of this.teams[1 - passer.team].players) {
      const r = distToSegment(o.pos, passer.pos, t.pos);
      if (r.t > 0.08 && r.t < 0.95 && r.d < 1.6) lane += (1.6 - r.d) / 1.6;
      const dr = fdist(o.pos, t.pos); if (dr < 1.6) rp = Math.max(rp, (1.6 - dr) / 1.6);
    }
    risk = Math.max(0.3, risk);
    let score = 0.6 * advance + 0.5 * prox - lane * (1.2 / risk) - rp * (0.7 / risk) - Math.max(0, d - 9) / 10;
    if (t.slot === 5 && !t.isGK) score += centerBonus * (1 - rp * 0.5);
    if (t.isGK) score -= 0.8;
    if (pref && len(pref) > 0.1) {
      const align = dot(mul(to, 1 / d), norm(flat(pref)));
      if (assist === 'PRO' && align < Math.cos(35 * DEG)) return -Infinity;
      score += align * (assist === 'ASSISTED' ? 0.6 : assist === 'STANDARD' ? 1.5 : 4);
    }
    return score;
  }
  chooseTarget(passer, pref, assist, risk, centerBonus, noise = 0) {
    let best = null, bs = -Infinity;
    for (const m of this.teams[passer.team].players) {
      let s = this.evaluate(passer, m, pref, assist, risk, centerBonus);
      if (s === -Infinity) continue;
      if (noise > 0) s += this.rng.bell() * noise;
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }
  passSpeed(p, d, lob) {
    let s = lerp(8, 12, this.effPass(p));
    if (d > 9) s += lerp(0, 3.5, this.effPower(p)) * invLerp(9, 18, d);
    return lob ? s * 0.55 : s;
  }
  passTo(passer, target, fallbackDir, lob) {
    const b = this.ball; if (b.owner !== passer) return;
    const from = { ...b.pos }; let aim;
    if (target) {
      const d0 = fdist(from, target.pos);
      aim = add(target.pos, clampMag(mul(flat(target.vel), d0 / this.passSpeed(passer, d0, lob)), 2));
    } else {
      const dir = fallbackDir && len(fallbackDir) > 0.1 ? norm(flat(fallbackDir)) : passer.facing;
      aim = add(passer.pos, mul(dir, 8));
    }
    const c = this.cfg;
    aim.y = 0.6; aim.x = clamp(aim.x, -c.hl + 0.5, c.hl - 0.5); aim.z = clamp(aim.z, -c.hw + 0.5, c.hw - 0.5);
    const dist0 = fdist(from, aim);
    let maxErr = lerp(7, 1.5, this.effPass(passer)); if (passer.human && c.assist === 'ASSISTED') maxErr *= 0.6;
    const ang = this.rng.bell() * maxErr * DEG, df = norm(flat(sub(aim, from)));
    const rot = V(df.x * Math.cos(ang) - df.z * Math.sin(ang), 0, df.x * Math.sin(ang) + df.z * Math.cos(ang));
    const le = 1 + this.rng.bell() * (1 - this.effPass(passer)) * 0.08;
    const fin = add(flat(from), mul(rot, dist0 * le)); fin.y = 0.6;
    const vel = ballistic(from, fin, this.passSpeed(passer, dist0, lob));
    b.passer = passer; b.receiver = target; this.release('PASSED', vel);
    passer.actionCd = 0.35;
    this.stats.teams[passer.team].passes++; this.emit(Ev.PASS, passer.team, passer.id, target ? target.id : -1, passer.pos);
  }

  // =============================================================== shots
  shoot(p, charge, timing, cmd) {
    const b = this.ball; if (b.owner !== p) return;
    const c = this.cfg, assist = p.human ? c.assist : 'PRO', goal = this.targetGoal(p.team), half = c.goalW / 2;
    let target;
    if (cmd.hasAim) {
      const lateral = -this.sign(p.team) * clamp(cmd.aimX, -1.3, 1.3) * half;
      target = V(goal.x, lerp(0.2, c.goalH - 0.1, cmd.aimY), goal.z + lateral);
    } else {
      const gkz = this.teams[1 - p.team].gk.pos.z, h = half - 0.32;
      let z = gkz > goal.z ? -h : h; if (Math.abs(gkz - goal.z) < 0.15) z = this.rng.chance(0.5) ? h : -h;
      target = V(goal.x, this.rng.chance(0.5) ? 0.3 : 0.65, z);
    }
    const from = { ...b.pos }, d = fdist(from, target);
    const skill = 0.65 * this.effAcc(p) + 0.35 * this.effShoot(p);
    let spread = (0.45 + (1 - skill) * 1.6) * (d / 7) * timingMult(timing);
    if (charge > 0.92) spread *= 1.25; if (cmd.quickShot) spread *= 1.3;
    spread *= 1 + this.pressure(p) * 0.5; if (p.human && assist === 'ASSISTED') spread *= 0.75;
    target.z += this.rng.bell() * spread; target.y += this.rng.bell() * spread * 0.7;
    if (assist === 'ASSISTED') { target.z = clamp(target.z, goal.z - half + 0.22, goal.z + half - 0.22); target.y = clamp(target.y, 0.15, c.goalH - 0.22); }
    else if (assist === 'STANDARD') { target.z = clamp(target.z, goal.z - half - 0.15, goal.z + half + 0.15); target.y = clamp(target.y, 0.1, c.goalH + 0.15); }
    target.y = Math.max(target.y, 0.05);
    let speed = lerp(10.5, 17, Math.pow(clamp01(charge), 0.8)) * lerp(0.82, 1.18, this.effPower(p));
    if (cmd.lobShot) { speed = 7; target.y = clamp(target.y, 0.55, c.goalH - 0.12); }
    const vel = ballistic(from, add(target, V(this.sign(p.team) * 0.4, 0, 0)), speed);
    b.shooter = p; b.receiver = null; this.release('SHOT', vel); p.actionCd = 0.5;
    this.stats.teams[p.team].shots++;
    this.emit(Ev.SHOT, p.team, p.id, -1, p.pos, len(vel)); this.events[this.events.length - 1].timing = timing;
  }

  // =============================================================== ball
  setBall(s) { const b = this.ball; b.state = s; b.stateTime = 0; b.tried.clear(); if (s !== 'SHOT') b.saveDone = false; }
  release(state, vel) { const b = this.ball; if (b.owner) { b.lastTouch = b.owner; b.owner.possTime = 0; } b.owner = null; b.vel = vel; this.setBall(state); }
  snap() { const b = this.ball, o = b.owner; b.pos = add(add(o.pos, mul(o.facing, 0.35)), V(0, HOLD_H, 0)); }
  give(p, fromPlay) {
    const b = this.ball, prev = b.possTeam;
    b.shooter = null; b.owner = p; b.lastTouch = p; b.possTeam = p.team; b.receiver = null; b.vel = V(); this.setBall('POSSESSED'); this.snap();
    p.possTime = 0; p.charging = false; p.charge = 0; p.aiCharge = -1; p.nextDecision = this.time + this.reactionTime(p);
    if (prev !== p.team) { this.assistCand = [null, null]; this.shotClockLeft = this.cfg.shotClock; if (fromPlay) this.emit(Ev.POSSESSION, p.team, p.id, -1, p.pos); }
    if (this.human && p.team === this.human.team && p !== this.human && !p.isGK) this.setHuman(p, true);
  }
  integrate(dt) {
    const b = this.ball; let v = { ...b.vel };
    const air = b.pos.y > BALL_R + 0.005 || v.y > 0.01;
    if (air) { v.y -= G * dt; v = mul(v, 1 - 0.03 * dt); }
    const p = add(b.pos, mul(v, dt));
    if (p.y <= BALL_R) { p.y = BALL_R; if (v.y < -2.5) { v.y = -v.y * 0.3; v.x *= 0.85; v.z *= 0.85; } else v.y = 0; }
    if (p.y <= BALL_R + 0.005 && Math.abs(v.y) < 0.01) { const k = Math.max(0, 1 - 1.7 * dt); v.x *= k; v.z *= k; }
    b.pos = p; b.vel = v; b.stateTime += dt;
  }
  onWater() { const b = this.ball; return b.pos.y <= BALL_R + 0.005 && Math.abs(b.vel.y) < 0.01; }
  boundaries(prev) {
    const b = this.ball, c = this.cfg, r = BALL_R;
    for (let side = 0; side < 2; side++) {
      const lineX = side === 1 ? c.hl : -c.hl, s = side === 1 ? 1 : -1;
      const pd = (prev.x - lineX) * s, d = (b.pos.x - lineX) * s;
      if (!(pd <= r && d > r)) continue;
      const cr = vlerp(prev, b.pos, (r - pd) / Math.max(1e-5, d - pd)), az = Math.abs(cr.z), hg = c.goalW / 2;
      const inside = az < hg - r && cr.y < c.goalH - r;
      const post = az >= hg - r && az <= hg + r && cr.y < c.goalH + r;
      const bar = az < hg + r && cr.y >= c.goalH - r && cr.y <= c.goalH + r;
      if (inside) {
        b.pos = V(lineX + s * Math.min(c.goalDepth, r * 3), Math.max(r, cr.y), cr.z); b.vel = V();
        const scoring = 1 - side, sh = b.shooter && b.shooter.team === scoring ? b.shooter : b.lastTouch && b.lastTouch.team === scoring ? b.lastTouch : null;
        let assist = sh ? this.assistCand[scoring] : null; if (assist === sh) assist = null;
        this.stats.teams[scoring].goals++; if (b.state === 'SHOT') this.stats.teams[scoring].onTarget++;
        this.setBall('GOAL'); this.onGoal(scoring);
        this.emit(Ev.GOAL, scoring, sh ? sh.id : -1, assist ? assist.id : -1, b.pos, this.teams[scoring].score);
        return;
      }
      if (post || bar) {
        const v = b.vel; v.x = -v.x * 0.45;
        if (post) v.z = -v.z * 0.5 + Math.sign(cr.z) * Math.abs(v.x) * 0.4; else v.y = -Math.abs(v.y) * 0.4;
        b.pos = V(lineX - s * (r + 0.02), cr.y, cr.z);
        this.emit(Ev.FRAME, b.shooter ? b.shooter.team : -1, b.shooter ? b.shooter.id : -1, -1, b.pos);
        this.setBall('DEFLECTED'); return;
      }
      this.outOfPlay('OUT_GOAL', side); return;
    }
    if (Math.abs(b.pos.z) > c.hw + r) this.outOfPlay('OUT_SIDE', -1);
  }
  outOfPlay(kind, side) {
    const b = this.ball;
    if (b.state === 'SHOT' && b.shooter) this.emit(Ev.OFF, b.shooter.team, b.shooter.id, -1, b.pos);
    this.emit(Ev.OUT, b.lastTouch ? b.lastTouch.team : -1, -1, -1, b.pos);
    this.onOut(kind, side, b.pos);
  }
  resolveGK() {
    const b = this.ball; if (b.state !== 'SHOT' || b.saveDone || !b.shooter) return;
    const gk = this.teams[1 - b.shooter.team].gk, s = this.sign(b.shooter.team), goalX = this.targetGoal(b.shooter.team).x;
    let plane = gk.pos.x; if ((plane - goalX) * s > 0) plane = goalX;
    if ((b.pos.x - plane) * s < -0.05) return;
    if (fdist(b.pos, gk.pos) > 3.5 && (b.pos.x - goalX) * s < -0.3) return;
    b.saveDone = true;
    const out = this.resolveSave(gk);
    if (out === 'CAUGHT' || out === 'PARRIED') {
      const sh = b.shooter;
      this.stats.teams[gk.team].saves++; this.stats.teams[sh.team].onTarget++;
      this.emit(Ev.SAVE, gk.team, gk.id, sh.id, b.pos, out === 'CAUGHT' ? 1 : 0);
      b.lastTouch = gk;
      if (out === 'CAUGHT') this.give(gk, true);
      else { b.vel = V(-b.vel.x * 0.25, 1.5 + this.rng.f(), this.rng.range(-3, 3)); b.pos = V(b.pos.x - s * 0.25, b.pos.y, b.pos.z); this.setBall('DEFLECTED'); }
    }
  }
  gkNorm(gk) { return N(gk.stats.goalkeeping); }
  gkReaction(gk, sk) { return lerp(0.34, 0.1, (N(gk.stats.reaction) + this.gkNorm(gk)) * 0.5 * sk); }
  predictCrossing(planeX) {
    const b = this.ball; if (Math.abs(b.vel.x) < 0.1) return null;
    const t = (planeX - b.pos.x) / b.vel.x; if (t < 0 || t > 3) return null;
    return V(planeX, Math.max(BALL_R, b.pos.y + b.vel.y * t - 0.5 * G * t * t), b.pos.z + b.vel.z * t);
  }
  resolveSave(gk) {
    const c = this.cfg, b = this.ball, goal = this.ownGoal(gk.team);
    const at = this.predictCrossing(goal.x);
    if (!at || Math.abs(at.z - goal.z) > c.goalW / 2 + 0.25 || at.y > c.goalH + 0.25) return 'NONE';
    const sk = this.skill(gk.team), avail = Math.max(0, b.stateTime - this.gkReaction(gk, sk));
    const reach = 0.6 + Math.min(avail * lerp(1.8, 3.4, this.gkNorm(gk)) * sk, lerp(0.7, 1.3, this.gkNorm(gk)));
    const dz = b.pos.z - gk.pos.z, dy = Math.max(0, b.pos.y - 0.45) * 1.25, gap = Math.hypot(dz, dy);
    if (gap > reach) return 'MISSED';
    const speed = len(b.vel), ratio = gap / reach;
    let p = 0.9 - ratio * ratio * 0.7 - Math.max(0, speed - 14) * 0.04 + N(gk.stats.positioning) * 0.05;
    p = clamp(p * lerp(0.85, 1.05, this.gkNorm(gk) * sk), 0.05, 0.95);
    if (!this.rng.chance(p)) return 'MISSED';
    return speed < lerp(10, 14, this.gkNorm(gk)) && ratio < 0.6 && this.rng.chance(0.7) ? 'CAUGHT' : 'PARRIED';
  }
  contacts() {
    const b = this.ball;
    if (b.state === 'PASSED') this.passFlight();
    else if (b.state === 'SHOT') this.shotBlocks();
    else if (b.state === 'FREE' || b.state === 'DEFLECTED' || b.state === 'BLOCKED') this.loose();
  }
  passFlight() {
    const b = this.ball; if (b.stateTime < 0.08 || b.pos.y > 2.2) return;
    const speed = len(b.vel);
    for (const o of this.players) {
      if (o.team === b.possTeam || o.stun > 0 || b.tried.has(o.id)) continue;
      const rad = 0.35 + 0.3 * N(o.stats.reaction) + 0.15 * this.effDef(o) + (o.isGK ? 0.3 : 0);
      if (fdist(o.pos, b.pos) > rad || b.pos.y > 1.5) continue;
      b.tried.add(o.id);
      if (this.rng.chance(clamp(0.2 + 0.3 * N(o.stats.reaction) * this.skill(o.team) - (speed - 10) * 0.04, 0.05, 0.6))) {
        this.stats.teams[o.team].interceptions++; this.emit(Ev.INTERCEPT, o.team, o.id, b.passer ? b.passer.id : -1, b.pos);
        this.give(o, true); return;
      }
    }
    if (this.tryCatch(b.receiver, speed)) return;
    for (const m of this.teams[b.possTeam].players) if (m !== b.receiver && m !== b.passer && this.tryCatch(m, speed)) return;
  }
  tryCatch(m, speed) {
    const b = this.ball; if (!m || m.stun > 0 || b.pos.y > 1.8) return false;
    const rad = 0.6 + 0.3 * N(m.stats.reaction) + (m.human && this.cfg.assist === 'ASSISTED' ? 0.3 : 0);
    if (fdist(m.pos, b.pos) > rad) return false;
    if (this.rng.chance(clamp(0.03 + (speed - 11) * 0.02 - N(m.stats.technique) * 0.05, 0, 0.3))) {
      b.lastTouch = m; b.vel = V(b.vel.x * 0.2, 0.5, b.vel.z * 0.2); this.setBall('FREE'); return true;
    }
    const passer = b.passer;
    if (passer && passer.team === m.team) {
      this.stats.teams[m.team].passesOk++; this.assistCand[m.team] = passer;
      this.emit(Ev.PASS_OK, m.team, passer.id, m.id, b.pos);
    }
    this.give(m, true); return true;
  }
  shotBlocks() {
    const b = this.ball; if (b.stateTime < 0.05 || b.pos.y > 1.5) return;
    for (const d of this.teams[1 - b.shooter.team].field) {
      if (b.tried.has(d.id) || d.stun > 0) continue;
      const rad = 0.35 + (d.block > 0 ? 0.5 : 0.15) + 0.2 * this.effDef(d);
      if (fdist(d.pos, b.pos) > rad) continue;
      b.tried.add(d.id);
      if (!this.rng.chance((d.block > 0 ? 0.3 + 0.4 * this.effDef(d) : 0.1) * this.skill(d.team))) continue;
      this.stats.teams[d.team].blocks++; this.emit(Ev.BLOCK, d.team, d.id, b.shooter.id, b.pos);
      const v = b.vel; b.lastTouch = d;
      b.vel = V(-v.x * 0.2 + this.rng.range(-1, 1), 1.2, v.z * 0.2 + this.rng.range(-2, 2)); this.setBall('BLOCKED'); return;
    }
  }
  loose() {
    const b = this.ball; if (b.pos.y > 0.9 || len(flat(b.vel)) > 7) return;
    let best = null, bd = 1e9;
    for (const p of this.players) {
      if (p.stun > 0) continue;
      const d = fdist(p.pos, b.pos);
      if (d <= 0.55 + 0.25 * N(p.stats.reaction) && d < bd) { best = p; bd = d; }
    }
    if (!best) return;
    const rebound = b.shooter && best.team === b.shooter.team && (b.state === 'DEFLECTED' || b.state === 'BLOCKED');
    this.give(best, true);
    if (rebound) this.shotClockLeft = Math.max(this.shotClockLeft, this.cfg.shotClockRebound);
  }
  settle() {
    const b = this.ball; if (['GOAL', 'OUT', 'FREE'].includes(b.state)) return;
    if (this.onWater() && len(flat(b.vel)) < 1.5 && b.stateTime > 0.2) {
      if (b.state === 'SHOT' && b.shooter) this.emit(Ev.OFF, b.shooter.team, b.shooter.id, -1, b.pos);
      this.setBall('FREE');
    }
  }

  // =============================================================== AI
  steer(p, t, arrive) {
    const d = flat(sub(t, p.pos)), l = len(d); if (l < 0.05) return V();
    return mul(d, (arrive > 0 ? clamp01(l / (arrive + 0.6)) : 1) / l);
  }
  shotQuality(p) {
    const goal = this.targetGoal(p.team), d = fdist(p.pos, goal);
    const range = lerp(7, 11, this.effShoot(p)) * lerp(0.9, 1.1, this.effPower(p));
    const df = 1 - clamp01((d - 2) / range);
    const ang = Math.atan2(Math.abs(p.pos.z - goal.z), Math.max(0.1, Math.abs(goal.x - p.pos.x)));
    const af = clamp01((ang - 0.6) / 0.8);
    let blockers = 0;
    for (const o of this.teams[1 - p.team].field) { const r = distToSegment(o.pos, p.pos, goal); if (r.t > 0.05 && r.t < 0.9 && r.d < 0.8) blockers++; }
    return clamp01(df * 0.8 + (1 - af) * 0.25 - this.pressure(p) * 0.25 - blockers * 0.18);
  }
  // Positions ("postes"): slot 0 right wing, 1 right flat (driver), 2 point (playmaker), 3 left flat,
  // 4 left wing, 5 centre-forward (2 m). In defence each player marks the opponent in the same slot;
  // the slot-5 defender is the 2 m defender. The slot sets WHERE a player plays, his role HOW.
  thinkField(p) {
    const cmd = {}, b = this.ball, tp = this.teams[p.team].tp;
    const intel = N(p.stats.intelligence) * this.skill(p.team);
    const decide = this.time >= p.nextDecision;
    if (decide) p.nextDecision = this.time + lerp(0.4, 0.15, intel) + (p.id % 3) * 0.02;
    const loose = b.state === 'FREE' || b.state === 'DEFLECTED' || b.state === 'BLOCKED';
    // Loose ball: only the closest player goes for it (plus a second one if he is right there);
    // everybody else keeps his position instead of swarming.
    const chase = loose && (this.amongClosest(p, 1) || (this.amongClosest(p, 2) && fdist(p.pos, b.pos) < 2.5));
    if (b.owner === p) this.carrier(p, cmd, decide, tp, intel);
    else if (chase) { cmd.move = this.steer(p, add(flat(b.pos), mul(flat(b.vel), 0.35)), 0.1); cmd.sprint = true; }
    else if (this.possessionTeam === p.team) this.support(p, cmd, decide, tp);
    else this.defend(p, cmd, decide, tp);
    p.cmd = cmd;
  }
  /** Push a target spot away from team-mates that already occupy the space (spacing). */
  spread(p, spot, radius, strength) {
    let out = { ...spot };
    for (const q of this.teams[p.team].field) {
      if (q === p) continue;
      const d = fdist(q.pos, spot);
      if (d < radius) { const away = d > 1e-3 ? norm(flat(sub(spot, q.pos))) : V(0, 0, p.id % 2 ? 1 : -1); out = add(out, mul(away, (radius - d) * strength)); }
    }
    return out;
  }
  carrier(p, cmd, decide, tp, intel) {
    const c = this.cfg, goal = this.targetGoal(p.team);
    if (p.aiCharge >= 0) {
      cmd.move = mul(this.steer(p, goal, 0), 0.2);
      if (p.charge < p.aiCharge) cmd.shootHeld = true; else p.aiCharge = -1;
      return;
    }
    const dg = fdist(p.pos, goal), pr = this.pressure(p);
    if (decide && p.actionCd <= 0) {
      let th = 0.5 + tp.shoot + p.prof.shoot;
      if (this.shotClockLeft < 5) th -= 0.3;
      const diff = this.teams[p.team].score - this.teams[1 - p.team].score;
      const late = this.period >= c.periods && this.periodLeft < c.periodDuration * 0.35;
      if (late && diff < 0) th -= 0.08; if (late && diff > 0) th += 0.05;
      if (this.shotQuality(p) > th) {
        p.aiCharge = clamp(lerp(EXC_MIN, EXC_MAX, this.rng.f()) + (1 - intel) * 0.25 * this.rng.bell(), 0.35, 1);
        cmd.shootHeld = true; return;
      }
      const hold = lerp(1, 2.2, this.rng.f()) * tp.tempo * p.prof.patience;
      const must = p.possTime > hold || pr > 0.55 || this.shotClockLeft < 3;
      if (must || this.rng.chance(0.15 + p.prof.passPref)) {
        const t = this.chooseTarget(p, null, 'STANDARD', p.prof.risk, tp.center, (1 - intel) * 0.45);
        if (t && (must || this.evaluate(p, t, null, 'STANDARD', p.prof.risk, tp.center) > 0.25)) {
          cmd.pass = true; cmd.passDir = norm(flat(sub(t.pos, p.pos))); cmd.lob = this.laneBlocked(p, t) && this.rng.chance(0.6); return;
        }
      }
    }
    // Counter-attack: swim the ball up the own lane; settled: work from the own position, attack space.
    let dest = dg > 9 ? V(goal.x, 0, clamp(p.pos.z, -4, 4)) : this.attackSpot(p.team, p.slot, tp);
    if (dg < 7 && pr < 0.3) dest = goal;
    cmd.move = this.steer(p, dest, 1.2);
    cmd.sprint = dg > 9 && p.stamina > 0.4 && this.rng.chance(tp.trans);
  }
  support(p, cmd, decide, tp) {
    const b = this.ball, goal = this.targetGoal(p.team);
    let spot;
    if (tp.safety > 0 && p.slot === 2) spot = V(this.sign(p.team) * -1.5, 0, 0);
    else {
      spot = this.attackSpot(p.team, p.slot, tp);
      // The whole shape slides toward the ball side (keeps passing lanes short).
      if (p.slot !== 5) spot.z = clamp(spot.z + clamp(b.pos.z * 0.25, -1.4, 1.4), -this.cfg.hw + 1, this.cfg.hw - 1);
      if (p.slot === 5) {
        // Centre-forward: fights for position at 2 m in front of the goal, never drifts away from it.
        spot = V(goal.x - this.sign(p.team) * 2.0, 0, clamp(b.pos.z * 0.15, -0.8, 0.8));
      } else {
        // "Appel": periodic drive toward goal, then back to the position.
        if (Math.sin(this.time * 0.7 + p.id * 1.7) > 0.6) spot = add(spot, mul(norm(flat(sub(goal, spot))), 1.2));
        const m = this.closestOpp(p);
        if (m.p && m.d < 1.1) spot = add(spot, mul(norm(flat(sub(p.pos, m.p.pos))), 0.8));   // get open
        const e = (1 - N(p.stats.positioning)) * 1.0;
        spot = add(spot, V(Math.sin(p.id * 3.1) * e, 0, Math.cos(p.id * 2.3) * e));
        spot = this.spread(p, spot, 2.4, 0.9);
      }
    }
    const d = fdist(p.pos, spot);
    cmd.move = this.steer(p, spot, 0.4);
    if (decide) p.wantSprint = d > 4 && p.stamina > 0.35 && this.rng.chance(Math.max(tp.trans, 0.6));
    cmd.sprint = p.wantSprint && d > 2;
  }
  defend(p, cmd, decide, tp) {
    const b = this.ball, og = this.ownGoal(p.team);
    const mark = this.teams[1 - p.team].field.find((o) => o.slot === p.slot) || this.closestOpp(p).p;
    if (!mark) { cmd.move = this.steer(p, og, 1); return; }
    const hasBall = b.owner === mark, md = tp.mark * (hasBall ? 0.75 : 1);
    const toGoal = flat(sub(og, mark.pos)), tgl = len(toGoal);
    const goalSide = add(mark.pos, mul(norm(toGoal), Math.min(md, tgl * 0.5)));
    // Beaten (the mark is closer to our goal than we are): recover goal-side first, at full speed.
    const beaten = fdist(p.pos, og) > tgl + 0.3;
    let target;
    if (beaten) {
      target = add(mark.pos, mul(norm(toGoal), Math.min(1.6, tgl * 0.6)));
      cmd.move = this.steer(p, target, 0.1); cmd.sprint = p.stamina > 0.15;
    } else {
      const toBall = flat(sub(b.pos, mark.pos));
      const ballSide = add(mark.pos, mul(norm(toBall), Math.min(md, len(toBall) * 0.5)));
      const denial = tp.denial * invLerp(5, 8, tgl);
      const man = hasBall ? goalSide : vlerp(goalSide, ballSide, denial);
      const zone = add(og, mul(norm(flat(sub(mark.pos, og))), Math.min(4, tgl)));
      target = vlerp(man, zone, hasBall ? tp.zone * 0.3 : tp.zone);
      // Read the pass only when it is meant for my man.
      if (b.state === 'PASSED' && b.possTeam !== p.team && b.receiver === mark) {
        const ahead = add(flat(b.pos), mul(flat(b.vel), 0.3));
        if (fdist(p.pos, ahead) < 2.5) target = ahead;
      }
      if (p.slot !== 5 && !hasBall) target = this.spread(p, target, 1.6, 0.6);
      const d = fdist(p.pos, target);
      cmd.move = this.steer(p, target, 0.15); cmd.sprint = d > 2.5 && p.stamina > 0.25;
    }
    if (decide) {
      const tc = hasBall ? fdist(p.pos, mark.pos) : 99;
      if (hasBall && mark.charging && tc < 2.5) cmd.defend = true;
      else if (hasBall && tc < 1.15 && p.stealCd <= 0 && this.rng.chance(0.22 * tp.press * p.prof.aggr)) cmd.defend = true;
    }
  }
  thinkGK(gk) {
    const cmd = {}, c = this.cfg, b = this.ball, goal = this.ownGoal(gk.team), s = this.sign(gk.team);
    if (b.owner === gk) {
      if (gk.possTime > 0.8 && gk.actionCd <= 0) {
        const t = this.chooseTarget(gk, null, 'STANDARD', 0.8, 0, (1 - N(gk.stats.intelligence)) * 0.3);
        if (t || gk.possTime > 3) { cmd.pass = true; cmd.passDir = t ? norm(flat(sub(t.pos, gk.pos))) : V(s, 0, 0); }
      }
      cmd.move = this.steer(gk, add(goal, V(s, 0, 0)), 0.3); gk.cmd = cmd; return;
    }
    const loose = b.state === 'FREE' || b.state === 'DEFLECTED' || b.state === 'BLOCKED';
    if (loose && fdist(b.pos, goal) < 3.5 && this.amongClosest(gk, 1, true)) { cmd.move = this.steer(gk, b.pos, 0); cmd.sprint = true; gk.cmd = cmd; return; }
    if (b.state === 'SHOT' && b.shooter && b.shooter.team !== gk.team) {
      let desired = gk.pos;
      if (b.stateTime >= this.gkReaction(gk, this.skill(gk.team))) { const cr = this.predictCrossing(gk.pos.x); if (cr) desired = V(gk.pos.x, 0, cr.z); }
      cmd.move = this.steer(gk, desired, 0); cmd.sprint = true; gk.cmd = cmd; return;
    }
    const bb = add(flat(b.pos), mul(flat(b.vel), 0.3 * N(gk.stats.intelligence)));
    const tb = flat(sub(bb, goal)), db = len(tb);
    const depth = lerp(0.6, 1.3, invLerp(3, 12, db));
    const desired = add(goal, mul(db > 0.01 ? mul(tb, 1 / db) : V(s, 0, 0), depth));
    desired.z *= 1 - (1 - N(gk.stats.positioning)) * 0.45;
    const lim = c.goalW / 2 + 0.1; desired.z = clamp(desired.z, goal.z - lim, goal.z + lim);
    desired.x = goal.x + s * Math.max(0.4, (desired.x - goal.x) * s);
    cmd.move = this.steer(gk, desired, 0.2); gk.cmd = cmd;
  }
}

export function timingQuality(charge, heldAtMax) {
  if (heldAtMax > 0.5) return 'POOR';
  if (charge >= EXC_MIN && charge <= EXC_MAX) return 'EXCELLENT';
  if (charge >= 0.5) return 'GOOD';
  return 'POOR';
}
const timingMult = (q) => (q === 'EXCELLENT' ? 0.5 : q === 'POOR' ? 1.6 : 1);
function ballistic(from, to, hspeed) {
  const d = sub(to, from), f = flat(d), dd = len(f);
  hspeed = Math.max(1, hspeed);
  const t = Math.max(0.05, dd / hspeed);
  const vy = (d.y + 0.5 * G * t * t) / t;
  const h = dd > 1e-4 ? mul(f, hspeed / dd) : V();
  return V(h.x, vy, h.z);
}
