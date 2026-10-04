// WATER POLO 26 MOBILE — game state & data layer (web build).
// Every number shown by the UI comes from here and is saved on the device (localStorage).
// Clubs, players and competitions are FICTIONAL: no licence is held for real names, logos or
// photos (see docs/UI.md). Real data can be plugged in later through the same structures,
// with `source` / `lastUpdated` fields filled from official sources.
import { Rng, N, TACTICS } from './sim.js';

const SAVE_KEY = 'wp26.save', SAVE_VERSION = 1;
const DATA_SOURCE = { source: 'WP26 original fictional data', lastUpdated: '2026-10-04', licensed: false };

// ---------------------------------------------------------------- reference data
export const COUNTRIES = [
  ['FRA', '🇫🇷'], ['ESP', '🇪🇸'], ['ITA', '🇮🇹'], ['HUN', '🇭🇺'], ['SRB', '🇷🇸'], ['CRO', '🇭🇷'], ['GRE', '🇬🇷'], ['MNE', '🇲🇪'],
  ['USA', '🇺🇸'], ['AUS', '🇦🇺'], ['NED', '🇳🇱'], ['GER', '🇩🇪'], ['BRA', '🇧🇷'], ['JPN', '🇯🇵'], ['CAN', '🇨🇦'], ['RSA', '🇿🇦'],
];
const FIRST = ['Lucas', 'Matteo', 'Nikola', 'Ádám', 'Pablo', 'Luka', 'Yannis', 'Marko', 'Ethan', 'Noah', 'Hugo', 'Daan', 'Felix', 'Rafael', 'Kenji', 'Liam',
  'Tom', 'Enzo', 'Viktor', 'Dario', 'Milan', 'Theo', 'Jonas', 'Ivan', 'Sami', 'Leo', 'Alex', 'Bruno', 'Nils', 'Oscar', 'Max', 'Andrea'];
const LAST = ['Marlin', 'Varga', 'Kovač', 'Delmar', 'Rivas', 'Petrov', 'Costa', 'Novak', 'Laurent', 'Brenner', 'Okafor', 'Santos', 'Tanaka', 'Moreau',
  'Horvat', 'Lindqvist', 'Aranda', 'Kiss', 'Marić', 'Vidal', 'Fontaine', 'Weber', 'Bianchi', 'Duarte', 'Nagy', 'Ricci', 'Jansen', 'Silva', 'Ortega', 'Klein'];
/** Stable appearance of a squad player (same face and body in the match, the menus and the cards). */
export function lookOf(p) { let h = 2166136261; for (const ch of p.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return { seed: (h >>> 0) % 1000003, role: p.role }; }
export const SLOT_ROLES = ['WINGER', 'FINISHER', 'PLAYMAKER', 'DEFENDER', 'WINGER', 'CENTER'];   // formation slots 0..5 (+ GK)
export const ROLE_ABBR = { GOALKEEPER: 'GB', CENTER: 'PV', DEFENDER: 'DF', WINGER: 'AI', PLAYMAKER: 'MJ', FINISHER: 'FI', ALL_ROUNDER: 'PO' };
const PERSONALITIES = ['LEADER', 'CREATIVE', 'CALM', 'AGGRESSIVE', 'TEAM_PLAYER', 'TACTICAL', 'RISK_TAKER'];
const STAT_KEYS = ['speed', 'accel', 'stamina', 'passing', 'shooting', 'power', 'accuracy', 'defense', 'reaction', 'positioning', 'technique', 'intelligence', 'physical', 'goalkeeping'];

export const CLUBS = [
  { id: 'sharks', name: 'Ocean Sharks', short: 'OCS', color: 0x0f4c81, color2: 0xffffff, rating: 74, logo: { shape: 'shield', symbol: 'fin' } },
  { id: 'barracudas', name: 'Marina Barracudas', short: 'MAB', color: 0x1f8a70, color2: 0xf2c81a, rating: 71, logo: { shape: 'circle', symbol: 'wave' } },
  { id: 'orcas', name: 'Coral Bay Orcas', short: 'CBO', color: 0x222b38, color2: 0xff6b4a, rating: 76, logo: { shape: 'hex', symbol: 'trident' } },
  { id: 'seals', name: 'Nordfjord Seals', short: 'NFS', color: 0x5b6c8f, color2: 0xe8eef7, rating: 66, logo: { shape: 'circle', symbol: 'star' } },
  { id: 'dolphins', name: 'Riviera Dolphins', short: 'RIV', color: 0x1e5bd8, color2: 0xffffff, rating: 72, logo: { shape: 'shield', symbol: 'wave' } },
  { id: 'waves', name: 'Atlas Waves', short: 'ATW', color: 0x7a2fd0, color2: 0x38c8ff, rating: 69, logo: { shape: 'hex', symbol: 'ball' } },
  { id: 'titans', name: 'Lagoon Titans', short: 'LGT', color: 0xb8321e, color2: 0xffd21a, rating: 79, logo: { shape: 'shield', symbol: 'trident' } },
];
export const POOLS = [{ id: 'aqua', name: 'AQUA ARENA' }, { id: 'oceanic', name: 'OCEANIC CENTER' }, { id: 'city', name: 'CITY AQUATIC' }];

export const SHOP_ITEMS = [
  { id: 'cap_black', kind: 'cap', name: 'shop.cap_black', color: 0x16181d, price: { coins: 600 } },
  { id: 'cap_cyan', kind: 'cap', name: 'shop.cap_cyan', color: 0x13c4e8, price: { coins: 600 } },
  { id: 'cap_gold', kind: 'cap', name: 'shop.cap_gold', color: 0xd9a91a, price: { gems: 25 } },
  { id: 'trim_gold', kind: 'trim', name: 'shop.trim_gold', color: 0xf2c81a, price: { coins: 900 } },
  { id: 'cel_splash', kind: 'celebration', name: 'shop.cel_splash', value: 'splash', price: { coins: 1200 } },
  { id: 'logo_crown', kind: 'symbol', name: 'shop.logo_crown', value: 'crown', price: { gems: 15 } },
];

export const EVENTS = [
  { id: 'ocean_cup', name: 'event.ocean_cup', tier: 'standard', matches: 3, ratings: [68, 72, 76], reward: { coins: 450, gems: 5 }, schedule: 'weekly' },
  { id: 'weekend', name: 'event.weekend', tier: 'special', matches: 2, ratings: [72, 78], reward: { coins: 350, gems: 10 }, schedule: 'weekend' },
  { id: 'elite', name: 'event.elite', tier: 'major', matches: 4, ratings: [76, 79, 82, 85], reward: { coins: 900, gems: 20 }, schedule: 'weekly', minLevel: 5 },
  { id: 'gala', name: 'event.gala', tier: 'premium', matches: 3, ratings: [82, 85, 88], reward: { coins: 1500, gems: 40 }, schedule: 'weekly', needTrophy: true },
];

const OBJECTIVE_POOL = [
  { id: 'goals', n: 5, reward: { coins: 150 } },
  { id: 'passes', n: 25, reward: { coins: 120 } },
  { id: 'wins', n: 1, reward: { coins: 200, gems: 2 } },
  { id: 'steals', n: 4, reward: { coins: 150 } },
  { id: 'matches', n: 2, reward: { coins: 100 } },
  { id: 'saves', n: 5, reward: { coins: 150 } },
  { id: 'shots', n: 12, reward: { coins: 120 } },
];
const DAILY_GIFTS = [{ coins: 100 }, { coins: 150 }, { coins: 200 }, { coins: 250, gems: 1 }, { coins: 300 }, { coins: 350 }, { coins: 400, gems: 5 }];

// ---------------------------------------------------------------- players
export function overall(p) {
  const s = p.stats;
  if (p.role === 'GOALKEEPER') return Math.round((s.goalkeeping * 3 + s.reaction * 2 + s.positioning * 2 + s.passing + s.intelligence + s.physical) / 10);
  const w = {
    CENTER: { physical: 3, power: 2, shooting: 2, technique: 2 }, DEFENDER: { defense: 3, physical: 2, positioning: 2, reaction: 1 },
    WINGER: { speed: 3, accel: 2, accuracy: 2, shooting: 1 }, PLAYMAKER: { passing: 3, intelligence: 3, technique: 2 },
    FINISHER: { shooting: 3, power: 2, accuracy: 2 }, ALL_ROUNDER: {},
  }[p.role] || {};
  let tot = 0, wt = 0;
  for (const k of STAT_KEYS) { if (k === 'goalkeeping') continue; const x = 1 + (w[k] || 0); tot += s[k] * x; wt += x; }
  return Math.round(tot / wt);
}
export const rarity = (ovr) => (ovr >= 85 ? 'legend' : ovr >= 78 ? 'elite' : ovr >= 70 ? 'rare' : 'common');

function makePlayer(rng, id, role, rating, slot, number) {
  const R = (b) => Math.max(25, Math.min(99, Math.round(rating + b + rng.range(-6, 6))));
  const s = {}; for (const k of STAT_KEYS) s[k] = R(0);
  s.goalkeeping = R(-45);
  const boost = { GOALKEEPER: { goalkeeping: 8, reaction: 6, positioning: 5, shooting: -30, speed: -10 }, CENTER: { physical: 12, power: 6, speed: -6, technique: 4 },
    DEFENDER: { defense: 10, physical: 6, positioning: 5, shooting: -6 }, WINGER: { speed: 8, accel: 8, accuracy: 4 },
    PLAYMAKER: { passing: 10, intelligence: 10, technique: 5 }, FINISHER: { shooting: 10, power: 8, accuracy: 6 } }[role] || {};
  for (const k in boost) s[k] = R(boost[k]);
  const c = COUNTRIES[Math.floor(rng.f() * COUNTRIES.length)];
  return {
    id, firstName: FIRST[Math.floor(rng.f() * FIRST.length)], lastName: LAST[Math.floor(rng.f() * LAST.length)],
    nationality: c[0], role, slot, number, level: 1, personality: PERSONALITIES[Math.floor(rng.f() * PERSONALITIES.length)],
    birthYear: 1994 + Math.floor(rng.f() * 12), height: 182 + Math.floor(rng.f() * 18) + (role === 'GOALKEEPER' || role === 'CENTER' ? 6 : 0),
    stats: s, ...DATA_SOURCE,
  };
}

/** Squad of a club (7 starters + 4 bench), deterministic from the club id. */
export function generateSquad(clubId, rating) {
  const rng = new Rng([...clubId].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0);
  const squad = [makePlayer(rng, `${clubId}-gk`, 'GOALKEEPER', rating, -1, 1)];
  SLOT_ROLES.forEach((role, i) => squad.push(makePlayer(rng, `${clubId}-${i}`, role, rating, i, i + 2)));
  ['GOALKEEPER', 'DEFENDER', 'WINGER', 'ALL_ROUNDER'].forEach((role, i) => squad.push(makePlayer(rng, `${clubId}-b${i}`, role, rating - 4, null, 8 + i)));
  return squad;
}

// ---------------------------------------------------------------- time helpers (real timers)
const DAY = 86400000;
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function startOfWeek(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); const wd = (d.getDay() + 6) % 7; return d.getTime() - wd * DAY; }
export function eventWindow(ev, t = Date.now()) {
  const wk = startOfWeek(t);
  if (ev.schedule === 'weekend') {
    const start = wk + 5 * DAY, end = wk + 7 * DAY;
    if (t >= start && t < end) return { active: true, start, end, cycle: `w${wk}` };
    return { active: false, start: t < start ? start : start + 7 * DAY, end: t < start ? end : end + 7 * DAY, cycle: `w${wk}` };
  }
  return { active: true, start: wk, end: wk + 7 * DAY, cycle: `w${wk}` };
}
export function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}j ${h}h` : h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

// ---------------------------------------------------------------- league
function roundRobin(ids) {
  const n = ids.length, arr = ids.slice(), rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; pairs.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(pairs.map(([h, a]) => ({ home: h, away: a, hs: null, as: null })));
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}
function newLeague(season) {
  const ids = ['user', ...CLUBS.map((c) => c.id)];
  const table = {}; for (const id of ids) table[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  return { season, round: 0, rounds: roundRobin(ids), table, champion: null };
}

// ---------------------------------------------------------------- state
function defaultState() {
  return {
    v: SAVE_VERSION, createdAt: Date.now(),
    profile: { level: 1, xp: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, trophies: [], history: [] },
    currencies: { coins: 1000, gems: 10 },
    club: { name: 'Aqua Lions', short: 'AQL', color: 0x1e5bd8, color2: 0xffffff, logo: { shape: 'shield', symbol: 'wave' }, pool: 'aqua', tactic: 'BALANCED' },
    squad: generateSquad('user', 70),
    lineup: null,
    inventory: { owned: [], equipped: { cap: null, trim: null, celebration: null } },
    league: newLeague(1),
    events: {},
    objectives: { day: '', list: [] },
    gift: { lastDay: '', streak: 0 },
  };
}

export class GameState {
  constructor() {
    this.listeners = new Set();
    this.data = this.load();
    if (!this.data.lineup) this.autoLineup(false);
    this.refreshDaily();
  }

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (raw && raw.v === SAVE_VERSION) return raw;
    } catch { /* corrupted or unavailable storage: start fresh */ }
    return defaultState();
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { /* private mode */ } this.listeners.forEach((f) => f()); }
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  reset() { this.data = defaultState(); this.autoLineup(false); this.refreshDaily(); this.save(); }

  // ------------------------------------------------ squad / lineup / TOTAL
  get squad() { return this.data.squad; }
  player(id) { return this.data.squad.find((p) => p.id === id); }
  /** lineup: { gk: id, slots: [6 ids] } ; bench = the rest */
  get lineup() { return this.data.lineup; }
  bench() { const used = new Set([this.lineup.gk, ...this.lineup.slots]); return this.squad.filter((p) => !used.has(p.id)); }

  /** Position bonus: +2 on every stat for a player in his natural slot, +1 for an all-rounder. Applied in matches. */
  slotBonus(p, slot) {
    if (slot === -1) return p.role === 'GOALKEEPER' ? 2 : -12;          // a field player in goal is heavily penalised
    if (p.role === 'GOALKEEPER') return -10;
    if (p.role === SLOT_ROLES[slot]) return 2;
    return p.role === 'ALL_ROUNDER' ? 1 : 0;
  }
  teamTotal(lineup = this.lineup) {
    const items = [[lineup.gk, -1], ...lineup.slots.map((id, i) => [id, i])];
    let base = 0, bonus = 0;
    for (const [id, slot] of items) { const p = this.player(id); base += overall(p); bonus += this.slotBonus(p, slot); }
    return { total: Math.round((base + bonus) / items.length), base: base / items.length, bonus: bonus / items.length };
  }
  swap(idA, idB) {
    const L = this.data.lineup, pos = (id) => (L.gk === id ? ['gk'] : L.slots.includes(id) ? ['slot', L.slots.indexOf(id)] : ['bench']);
    const a = pos(idA), b = pos(idB);
    const put = (p, id) => { if (p[0] === 'gk') L.gk = id; else if (p[0] === 'slot') L.slots[p[1]] = id; };
    put(a, idB); put(b, idA);
    this.save();
  }
  /** "MEILLEUR TOTAL": best player for each slot, greedy on the slot-adjusted rating. */
  autoLineup(save = true) {
    const pool = this.squad.slice(), take = (score) => { pool.sort((a, b) => score(b) - score(a)); return pool.shift(); };
    const gk = take((p) => overall(p) + this.slotBonus(p, -1) * 5);
    const slots = [];
    for (const i of [5, 2, 1, 3, 0, 4]) slots[i] = take((p) => overall(p) + this.slotBonus(p, i) * 3).id;
    this.data.lineup = { gk: gk.id, slots };
    if (save) this.save();
  }
  upgradeCost(p) { return 150 * p.level; }
  upgrade(id) {
    const p = this.player(id), cost = this.upgradeCost(p);
    if (p.level >= 20 || !this.spend({ coins: cost })) return false;
    for (const k of STAT_KEYS) if (k !== 'goalkeeping' || p.role === 'GOALKEEPER') p.stats[k] = Math.min(99, p.stats[k] + 1);
    p.level++; this.save(); return true;
  }

  // ------------------------------------------------ currencies
  canAfford(price) { const c = this.data.currencies; return (price.coins || 0) <= c.coins && (price.gems || 0) <= c.gems; }
  spend(price) {
    if (!this.canAfford(price)) return false;
    this.data.currencies.coins -= price.coins || 0; this.data.currencies.gems -= price.gems || 0; return true;
  }
  grant(r) { this.data.currencies.coins += r.coins || 0; this.data.currencies.gems += r.gems || 0; }

  // ------------------------------------------------ XP / level
  xpForLevel(l) { return 400 + l * 100; }
  addXp(x) {
    const pr = this.data.profile; pr.xp += x; let ups = 0;
    while (pr.xp >= this.xpForLevel(pr.level)) { pr.xp -= this.xpForLevel(pr.level); pr.level++; ups++; }
    return ups;
  }

  // ------------------------------------------------ teams for the match engine
  clubInfo(id) {
    if (id === 'user') { const c = this.data.club; return { id: 'user', name: c.name, short: c.short, color: c.color, color2: c.color2, logo: c.logo, total: this.teamTotal().total }; }
    const c = CLUBS.find((x) => x.id === id);
    return { ...c, total: this.opponentTotal(id) };
  }
  opponentSquad(id, rating) { const c = CLUBS.find((x) => x.id === id); return generateSquad(id, rating ?? c.rating); }
  opponentTotal(id, rating) {
    const sq = this.opponentSquad(id, rating);
    return Math.round(sq.slice(0, 7).reduce((a, p) => a + overall(p) + this.slotBonus(p, p.slot ?? -1), 0) / 7);
  }
  /** Team definition for sim.js Match (stats include the real position bonus). */
  userTeamDef() {
    const L = this.lineup, c = this.data.club;
    const toDef = (p, slot) => {
      const b = this.slotBonus(p, slot), stats = {};
      for (const k of STAT_KEYS) stats[k] = Math.max(1, Math.min(99, p.stats[k] + b));
      return { name: `${p.firstName[0]}. ${p.lastName}`, number: slot === -1 ? 1 : p.number, role: slot === -1 ? 'GOALKEEPER' : SLOT_ROLES[slot], personality: p.personality, stats, slot, playerId: p.id, look: lookOf(p) };
    };
    return { id: 'user', name: c.name, short: c.short, color: c.color, tactic: c.tactic,
      players: [toDef(this.player(L.gk), -1), ...L.slots.map((id, i) => toDef(this.player(id), i))] };
  }
  opponentTeamDef(id, rating) {
    const c = CLUBS.find((x) => x.id === id), sq = this.opponentSquad(id, rating).slice(0, 7);
    return { id, name: c.name, short: c.short, color: c.color, tactic: TACTICS[[...id].length % TACTICS.length],
      players: sq.map((p) => ({ name: `${p.firstName[0]}. ${p.lastName}`, number: p.number, role: p.role, personality: p.personality, stats: p.stats, slot: p.slot ?? -1, look: lookOf(p) })) };
  }

  // ------------------------------------------------ league
  nextLeagueMatch() {
    const lg = this.data.league; if (lg.round >= lg.rounds.length) return null;
    const fx = lg.rounds[lg.round].find((f) => f.home === 'user' || f.away === 'user');
    const opp = fx.home === 'user' ? fx.away : fx.home;
    return { round: lg.round + 1, rounds: lg.rounds.length, opponent: opp, season: lg.season };
  }
  standings() {
    const t = this.data.league.table;
    return Object.entries(t).map(([id, r]) => ({ id, ...r, gd: r.gf - r.ga, info: this.clubInfo(id) }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.info.name.localeCompare(b.info.name));
  }
  recordLeague(hs, as, homeId, awayId) {
    const t = this.data.league.table, H = t[homeId], A = t[awayId];
    H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
    if (hs > as) { H.w++; A.l++; H.pts += 3; } else if (hs < as) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  /** Other fixtures of the round: quick result model driven by the real team totals. */
  simulateFixture(f, rng) {
    const th = this.clubInfo(f.home).total, ta = this.clubInfo(f.away).total;
    const goals = (atk, def) => { const lam = Math.max(1.5, 5 + (atk - def) * 0.18); let k = 0, p = Math.exp(-lam), s = p, u = rng.f(); while (u > s && k < 20) { k++; p *= lam / k; s += p; } return k; };
    f.hs = goals(th, ta); f.as = goals(ta, th);
    this.recordLeague(f.hs, f.as, f.home, f.away);
  }

  // ------------------------------------------------ events (real timers)
  eventState(ev, now = Date.now()) {
    const w = eventWindow(ev, now);
    let st = this.data.events[ev.id];
    if (!st || st.cycle !== w.cycle) st = { cycle: w.cycle, progress: 0, claimed: false };
    const pr = this.data.profile;
    let status;
    if (ev.minLevel && pr.level < ev.minLevel) status = 'LOCKED';
    else if (ev.needTrophy && !pr.trophies.length) status = 'LOCKED';
    else if (!w.active) status = 'UPCOMING';
    else if (st.progress >= ev.matches) status = st.claimed ? 'COMPLETED' : 'CLAIMABLE';
    else status = st.progress > 0 ? 'ACTIVE' : 'AVAILABLE';
    return { ...st, status, window: w, remaining: (w.active ? w.end : w.start) - now };
  }
  eventOpponent(ev) {
    const st = this.eventState(ev), idx = Math.min(st.progress, ev.matches - 1);
    return { club: CLUBS[(idx * 3 + ev.id.length) % CLUBS.length].id, rating: ev.ratings[idx], index: idx };
  }
  claimEvent(ev) {
    const st = this.eventState(ev); if (st.status !== 'CLAIMABLE') return null;
    this.data.events[ev.id] = { cycle: st.cycle, progress: st.progress, claimed: true };
    this.grant(ev.reward); this.save(); return ev.reward;
  }

  // ------------------------------------------------ daily objectives & gift
  refreshDaily() {
    const today = dayKey(), o = this.data.objectives;
    if (o.day !== today) {
      const rng = new Rng([...today].reduce((a, c) => a * 33 + c.charCodeAt(0), 5) >>> 0);
      const pool = OBJECTIVE_POOL.slice(), list = [];
      for (let i = 0; i < 3; i++) { const j = Math.floor(rng.f() * pool.length); const def = pool.splice(j, 1)[0]; list.push({ ...def, progress: 0, claimed: false }); }
      this.data.objectives = { day: today, list };
    }
  }
  claimObjective(id) {
    const ob = this.data.objectives.list.find((x) => x.id === id);
    if (!ob || ob.claimed || ob.progress < ob.n) return null;
    ob.claimed = true; this.grant(ob.reward); this.save(); return ob.reward;
  }
  giftAvailable() { return this.data.gift.lastDay !== dayKey(); }
  nextGift() { return DAILY_GIFTS[this.data.gift.streak % DAILY_GIFTS.length]; }
  claimGift() {
    if (!this.giftAvailable()) return null;
    const r = this.nextGift(); this.data.gift.streak++; this.data.gift.lastDay = dayKey(); this.grant(r); this.save(); return r;
  }
  badgeCount() {
    this.refreshDaily();
    return (this.giftAvailable() ? 1 : 0) + this.data.objectives.list.filter((o) => !o.claimed && o.progress >= o.n).length
      + EVENTS.filter((e) => this.eventState(e).status === 'CLAIMABLE').length;
  }

  // ------------------------------------------------ shop / customisation
  owns(id) { return this.data.inventory.owned.includes(id); }
  buy(item) {
    if (this.owns(item.id) || !this.spend(item.price)) return false;
    this.data.inventory.owned.push(item.id); this.equip(item); return true;
  }
  equip(item) {
    const eq = this.data.inventory.equipped;
    if (item.kind === 'symbol') this.data.club.logo.symbol = item.value;
    else eq[item.kind] = eq[item.kind] === item.id ? null : item.id;
    this.save();
  }
  equippedColor(kind) { const id = this.data.inventory.equipped[kind]; const it = SHOP_ITEMS.find((x) => x.id === id); return it ? it.color : null; }
  celebration() { const id = this.data.inventory.equipped.celebration; const it = SHOP_ITEMS.find((x) => x.id === id); return it ? it.value : 'arms'; }

  // ------------------------------------------------ match result -> everything
  /**
   * @param ctx { mode: 'league'|'event'|'quick', eventId?, opponent }
   * @param res { hs, as, stats (user team), gkSaves }
   * @returns rewards summary for the end screen
   */
  applyResult(ctx, res) {
    const pr = this.data.profile, win = res.hs > res.as, draw = res.hs === res.as;
    pr.matches++; if (win) pr.wins++; else if (draw) pr.draws++; else pr.losses++;
    pr.goalsFor += res.hs; pr.goalsAgainst += res.as;
    const mult = ctx.mode === 'quick' ? 0.5 : 1;
    const coins = Math.round(((win ? 150 : draw ? 80 : 50) + res.hs * 10) * mult);
    const xp = Math.round(((win ? 120 : draw ? 70 : 40) + res.hs * 5) * mult);
    this.grant({ coins });
    const levelUps = this.addXp(xp);
    const out = { coins, xp, levelUps, objectives: [], event: null, league: null };

    // Objectives
    this.refreshDaily();
    const s = res.stats, gains = { goals: res.hs, passes: s.passesOk, wins: win ? 1 : 0, steals: s.steals + s.interceptions, matches: 1, saves: s.saves, shots: s.shots };
    for (const ob of this.data.objectives.list) {
      if (ob.claimed) continue;
      const before = ob.progress; ob.progress = Math.min(ob.n, ob.progress + (gains[ob.id] || 0));
      if (before < ob.n && ob.progress >= ob.n) out.objectives.push(ob.id);
    }
    // League
    if (ctx.mode === 'league') {
      const lg = this.data.league, round = lg.rounds[lg.round], rng = new Rng((Date.now() & 0xffffff) + lg.round);
      const fx = round.find((f) => f.home === 'user' || f.away === 'user');
      if (fx.home === 'user') { fx.hs = res.hs; fx.as = res.as; } else { fx.hs = res.as; fx.as = res.hs; }
      this.recordLeague(fx.hs, fx.as, fx.home, fx.away);
      for (const f of round) if (f !== fx) this.simulateFixture(f, rng);
      lg.round++;
      const pos = this.standings().findIndex((r) => r.id === 'user') + 1;
      out.league = { position: pos, finished: lg.round >= lg.rounds.length };
      if (out.league.finished) {
        lg.champion = this.standings()[0].id;
        if (lg.champion === 'user') { pr.trophies.push({ name: 'league', season: lg.season, date: Date.now() }); this.grant({ coins: 1000, gems: 25 }); out.league.champion = true; }
        this.data.league = newLeague(lg.season + 1);
      }
    }
    // Event
    if (ctx.mode === 'event') {
      const ev = EVENTS.find((e) => e.id === ctx.eventId), st = this.eventState(ev);
      const progress = win ? st.progress + 1 : st.progress;
      this.data.events[ev.id] = { cycle: st.cycle, progress, claimed: false };
      out.event = { id: ev.id, progress, total: ev.matches, won: win };
    }
    pr.history.unshift({ date: Date.now(), mode: ctx.mode, opponent: ctx.opponent, hs: res.hs, as: res.as });
    pr.history.length = Math.min(pr.history.length, 20);
    this.save();
    return out;
  }
}

export { STAT_KEYS, N };
