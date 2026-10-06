// WATER POLO 26 MOBILE — game state & data layer (web build).
// Every number shown by the UI comes from here and is saved on the device (localStorage).
// Clubs, players and competitions are FICTIONAL: no licence is held for real names, logos or
// photos (see docs/UI.md). Real data can be plugged in later through the same structures,
// with `source` / `lastUpdated` fields filled from official sources.
import { Rng, N, TACTICS, DRILLS } from './sim.js';
import CLUB_DB from './data/clubs.js';

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

// Clubs of the game: REAL clubs as reference data (web/data/clubs.json: official name, city, country,
// competition, sources) with an ADAPTED identity used everywhere in the game (adapted name, original
// logo and kits, game rating). The official name is never displayed by default.
export const LEAGUES = CLUB_DB.leagues;
export const CLUBS = CLUB_DB.clubs.map((c) => ({
  id: c.id, name: c.gameClubName, short: c.shortName, color: c.colors[0], color2: c.colors[1], color3: c.colors[2], rating: c.rating,
  logo: c.logo, kits: c.kits, country: c.country, city: c.city, competition: c.gameCompetition,
  ref: { officialReferenceName: c.officialReferenceName, competition: c.competition, season: c.season, source: c.source, lastUpdated: c.lastUpdated },
}));
export const COUNTRY_LEAGUES = [...new Set(CLUBS.map((c) => c.country))];
/** Default kits for a club identity (home: colours 1/2, away: colour 2 with white cap, GK red cap). */
export function defaultKits(c1, c2, c3 = c2) {
  return { home: { suit: c1, suit2: c2, pattern: 'plain', cap: c1, capTrim: c2, number: c2 },
    away: { suit: c2, suit2: c1, pattern: 'plain', cap: 0xf4f6f8, capTrim: c1, number: c1 }, goalkeeper: { cap: 0xd81a1f, capTrim: 0xffffff, number: 0xffffff }, c3 };
}
// Home pools of the club (customisation): name + arena ambience used when the club plays at home.
export const POOLS = [{ id: 'aqua', name: 'AQUA ARENA', ambience: 'EVENT' }, { id: 'oceanic', name: 'OCEANIC CENTER', ambience: 'DAY' },
  { id: 'city', name: 'CITY AQUATIC', ambience: 'EVENING' }, { id: 'dome', name: 'MIDNIGHT DOME', ambience: 'NIGHT' }];
/** Ball designs (customisation): base colour, shade, groove colour. */
export const BALL_DESIGNS = { classic: ['#ffd21a', '#f2b705', '#0d2a6b'], ocean: ['#f4f6f8', '#d6e0ea', '#1e5bd8'], sunset: ['#ff8a1a', '#e2650a', '#16181d'], lime: ['#c8f51a', '#9ccc08', '#5a1fb8'] };

export const SHOP_ITEMS = [
  { id: 'cap_black', kind: 'cap', name: 'shop.cap_black', color: 0x16181d, price: { coins: 600 } },
  { id: 'cap_cyan', kind: 'cap', name: 'shop.cap_cyan', color: 0x13c4e8, price: { coins: 600 } },
  { id: 'cap_gold', kind: 'cap', name: 'shop.cap_gold', color: 0xd9a91a, price: { gems: 25 } },
  { id: 'trim_gold', kind: 'trim', name: 'shop.trim_gold', color: 0xf2c81a, price: { coins: 900 } },
  { id: 'cel_splash', kind: 'celebration', name: 'shop.cel_splash', value: 'splash', price: { coins: 1200 } },
  { id: 'logo_crown', kind: 'symbol', name: 'shop.logo_crown', value: 'crown', price: { gems: 15 } },
];

export const EVENTS = [
  { id: 'ocean_cup', name: 'event.ocean_cup', tier: 'standard', matches: 3, ratings: [68, 72, 76], reward: { coins: 450, gems: 5, token: 0 }, schedule: 'weekly' },
  { id: 'weekend', name: 'event.weekend', tier: 'special', matches: 2, ratings: [72, 78], reward: { coins: 350, gems: 10, token: 1, energy: 2 }, schedule: 'weekend' },
  { id: 'elite', name: 'event.elite', tier: 'major', matches: 4, ratings: [76, 79, 82, 85], reward: { coins: 900, gems: 20, token: 2 }, schedule: 'weekly', minLevel: 5 },
  { id: 'gala', name: 'event.gala', tier: 'premium', matches: 3, ratings: [82, 85, 88], reward: { coins: 1500, gems: 40, token: 3 }, schedule: 'weekly', needTrophy: true },
];

// Tournaments of the game, inspired by real competition formats (names adapted, no official marks):
// national cups of each country, continental club competitions, international club events.
const FLAG_NAMES = { FRA: 'France', ITA: 'Italia', ESP: 'España', HUN: 'Magyar', GRE: 'Hellas', CRO: 'Hrvatska', SRB: 'Srbija', GER: 'Deutschland' };
export const TOURNAMENTS = [
  ...['FRA', 'ITA', 'ESP', 'HUN', 'GRE', 'CRO'].map((c) => ({ id: 'cup-' + c, scope: 'national', country: c, countries: [c], name: `Coupe ${FLAG_NAMES[c]}`,
    format: 'ko', size: ['HUN', 'GRE', 'CRO', 'SRB', 'GER'].includes(c) ? 4 : 8, reward: { coins: 700, gems: 8, token: 1 }, inspiredBy: 'national cup',
    art: 'goblet', bg: { FRA: ['#1f4fd6', '#0b1d5c'], ITA: ['#0f9a58', '#064326'], ESP: ['#d4202b', '#5e0a10'], HUN: ['#2f8a4c', '#0f3a1e'], GRE: ['#1d7ad6', '#0a2f63'], CRO: ['#d6303a', '#3a1a6e'] }[c] })),
  { id: 'adria', scope: 'regional', name: 'Adria League', countries: ['CRO', 'SRB'], format: 'league', size: 6, reward: { coins: 900, gems: 12, token: 1 }, minLevel: 2, inspiredBy: 'regional league (Adriatic)', art: 'wave', bg: ['#14b7c9', '#0a4a66'] },
  { id: 'euro-challenge', scope: 'continental', name: 'Euro Challenge Cup', format: 'ko', size: 8, skipTop: 8, reward: { coins: 1200, gems: 15, token: 2 }, minLevel: 3, inspiredBy: 'second European club cup', art: 'tower', bg: ['#e2541c', '#4a0c08'] },
  { id: 'med-cup', scope: 'continental', name: 'Mediterranean Club Cup', countries: ['FRA', 'ITA', 'ESP', 'GRE', 'CRO'], format: 'groups', groupSize: 4, size: 8, reward: { coins: 1400, gems: 18, token: 2 }, minLevel: 4, inspiredBy: 'Mediterranean club tournaments', art: 'plate', bg: ['#0aa37a', '#053d34'] },
  { id: 'euro-champions', scope: 'continental', name: 'Euro Champions Aqua', format: 'groups', groupSize: 4, size: 16, reward: { coins: 2500, gems: 30, token: 3 }, minLevel: 6, inspiredBy: 'European club champions competition', art: 'bigear', bg: ['#2b2fb8', '#0a0d3e'] },
  { id: 'world-masters', scope: 'international', name: 'World Club Masters', format: 'ko', size: 8, reward: { coins: 3000, gems: 40, token: 3 }, minLevel: 8, inspiredBy: 'international club tournaments', art: 'globe', bg: ['#f2a516', '#7a3c00'] },
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
export const DAILY_GIFTS = [{ coins: 100, medkits: 1 }, { coins: 150, tp: 100 }, { coins: 200, energy: 1 }, { coins: 250, gems: 1, medkits: 1 }, { coins: 300, tp: 150 }, { coins: 350, energy: 1 }, { coins: 400, gems: 5, token: 0 }];

// ---------------------------------------------------------------- progression
// Quality tiers (card frame): bronze -> silver -> gold -> purple. Each tier raises the training cap.
export const QUALITIES = ['bronze', 'silver', 'gold', 'purple'];
export const maxLevel = (p) => 10 + 5 * (p.quality || 0);
/** Skills: real stat bonuses in matches (per skill level). */
export const SKILLS = {
  sniper: { shooting: 2, accuracy: 2 }, cannon: { power: 3, shooting: 1 }, playmaker: { passing: 2, intelligence: 2 }, wall: { defense: 3, positioning: 1 },
  anchor: { physical: 3, power: 1 }, sprinter: { speed: 2, accel: 2 }, reflex: { goalkeeping: 2, reaction: 2 }, engine: { stamina: 3, speed: 1 }, vision: { positioning: 2, intelligence: 2 },
};
const ROLE_SKILLS = { GOALKEEPER: ['reflex', 'vision'], CENTER: ['anchor', 'cannon'], DEFENDER: ['wall', 'anchor'], WINGER: ['sprinter', 'sniper'],
  PLAYMAKER: ['playmaker', 'vision'], FINISHER: ['sniper', 'cannon'], ALL_ROUNDER: ['engine', 'vision'] };
const BOOST_STATS = ['speed', 'accel', 'stamina', 'physical'];
/** Fills the progression fields of a player (new players and old saves). */
export function ensurePlayer(p) {
  if (p.quality === undefined) p.quality = 0;
  if (p.form === undefined) p.form = 100;
  if (p.boost === undefined) p.boost = 0;
  if (!p.skills) p.skills = (ROLE_SKILLS[p.role] || ROLE_SKILLS.ALL_ROUNDER).map((id, i) => ({ id, level: i === 0 ? 1 : 0 }));
  if (!p.career) p.career = { matches: 0, wins: 0, draws: 0, goals: 0, assists: 0, shots: 0, steals: 0, saves: 0, passes: 0 };
  if (!p.weight) p.weight = Math.round(p.height * 0.48 + (p.role === 'CENTER' ? 12 : p.role === 'WINGER' ? -4 : 2));
  return p;
}
/** Stats used in a match: trained stats + skills + PHYSIQUE boost, scaled by form (0..100: -8 % .. 0 %). */
export function matchStats(p) {
  const st = {}, f = 0.92 + 0.08 * Math.max(0, Math.min(100, p.form ?? 100)) / 100;
  for (const k of STAT_KEYS) {
    let v = p.stats[k];
    for (const sk of p.skills || []) if (sk.level > 0 && SKILLS[sk.id][k]) v += SKILLS[sk.id][k] * sk.level;
    if (p.boost > 0 && BOOST_STATS.includes(k)) v += 4;
    st[k] = Math.max(1, Math.min(99, Math.round(v * f)));
  }
  return st;
}
/** Value of a player when exchanged for training points. */
export const tradeValue = (p) => Math.round(overall(p) * 3 + (p.level - 1) * 25 + (p.quality || 0) * 150);

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
  return ensurePlayer({
    id, firstName: FIRST[Math.floor(rng.f() * FIRST.length)], lastName: LAST[Math.floor(rng.f() * LAST.length)],
    nationality: c[0], role, slot, number, level: 1, personality: PERSONALITIES[Math.floor(rng.f() * PERSONALITIES.length)],
    birthYear: 1994 + Math.floor(rng.f() * 12), height: 182 + Math.floor(rng.f() * 18) + (role === 'GOALKEEPER' || role === 'CENTER' ? 6 : 0),
    stats: s, ...DATA_SOURCE,
  });
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
function roundRobin(ids0) {
  const ids = ids0.length % 2 ? [...ids0, null] : ids0.slice();   // odd: one club rests each round (bye)
  const n = ids.length, arr = ids.slice(), rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; pairs.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(pairs.filter(([h, a]) => h && a).map(([h, a]) => ({ home: h, away: a, hs: null, as: null })));
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}
/** National championship of the user's club country: the user's club replaces its base club. */
function newLeague(season, country = 'FRA', baseClubId = null) {
  const ids = ['user', ...CLUBS.filter((c) => c.country === country && c.id !== baseClubId).map((c) => c.id)];
  const table = {}; for (const id of ids) table[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  return { season, country, round: 0, rounds: roundRobin(ids), table, champion: null, name: (LEAGUES[country] || {}).game || 'League' };
}

// ---------------------------------------------------------------- state
function defaultState() {
  return {
    v: SAVE_VERSION, createdAt: Date.now(),
    profile: { level: 1, xp: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, trophies: [], history: [] },
    currencies: { coins: 1000, gems: 10, tp: 300, medkits: 3, energy: 3, tokens: [1, 0, 0, 0] },
    recruits: 0,
    club: { name: 'Aqua Lions', short: 'AQL', city: 'Marseille', country: 'FRA', color: 0x1e5bd8, color2: 0xffffff, color3: 0x0b2348, logo: { shape: 'shield', symbol: 'wave', letters: 'AQL', pattern: 'none', border: 'single' },
      kits: defaultKits(0x1e5bd8, 0xffffff, 0x0b2348), ball: 'classic', pool: 'aqua', tactic: 'BALANCED', formation: 'arc', baseClubId: null, customClubId: null, createdAt: Date.now() },
    clubChosen: false,
    tournaments: {},
    challenges: {},
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
      if (raw && raw.v === SAVE_VERSION) {
        // Saves made before the progression system: add the new fields.
        const c = raw.currencies; c.tp ??= 300; c.medkits ??= 3; c.energy ??= 3; c.tokens ??= [1, 0, 0, 0]; raw.recruits ??= 0;
        raw.squad.forEach(ensurePlayer);
        // Saves made before the real-clubs system: club identity fields, league of the club's country.
        const cl = raw.club, d = defaultState().club;
        for (const k of ['city', 'country', 'color3', 'ball', 'formation', 'baseClubId', 'customClubId']) cl[k] ??= d[k];
        cl.kits ??= defaultKits(cl.color, cl.color2, cl.color3); cl.logo.letters ??= cl.short; cl.logo.pattern ??= 'none'; cl.logo.border ??= 'single';
        raw.tournaments ??= {}; raw.clubChosen ??= true; raw.challenges ??= {};
        const known = new Set(['user', ...CLUBS.map((x) => x.id)]);
        if (!raw.league.country || Object.keys(raw.league.table).some((id) => !known.has(id))) raw.league = newLeague(raw.league.season || 1, cl.country, cl.baseClubId);
        return raw;
      }
    } catch { /* corrupted or unavailable storage: start fresh */ }
    return defaultState();
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { /* private mode */ } this.listeners.forEach((f) => f()); }
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  reset() { this.data = defaultState(); this.autoLineup(false); this.refreshDaily(); this.save(); }

  // ------------------------------------------------ club choice (real club base -> own version)
  /** Real club of the database (game identity). */
  baseClub(id) { return CLUBS.find((c) => c.id === id) || null; }
  /** Identity draft from a real club (for "JOUER AVEC" or as the starting point of "CRÉER MA VERSION"). */
  draftFrom(baseId) {
    const b = baseId ? this.baseClub(baseId) : null;
    if (!b) { const d = defaultState().club; return { ...d, name: 'Mon Club', short: 'MON', logo: { ...d.logo, letters: 'MON' }, baseClubId: null }; }
    return { name: b.name, short: b.short, city: b.city, country: b.country, color: b.color, color2: b.color2, color3: b.color3,
      logo: { ...b.logo }, kits: JSON.parse(JSON.stringify(b.kits)), ball: 'classic', pool: 'aqua', tactic: 'BALANCED', formation: 'arc', baseClubId: b.id };
  }
  /**
   * Starts the career with a club. mode 'with' = the club of the game as it is; 'version' = the user's own
   * version (identity edited in the editor, kept with baseClubId). squad: 'start' (starting squad generated
   * from the club level) or 'own' (younger squad + recruitment budget).
   */
  chooseClub(identity, { mode = 'with', squad = 'start' } = {}) {
    const b = identity.baseClubId ? this.baseClub(identity.baseClubId) : null, rating = b ? b.rating - 2 : 68;
    const club = { ...defaultState().club, ...identity, tactic: identity.tactic || 'BALANCED', createdAt: Date.now() };
    club.customClubId = mode === 'version' || !b ? 'my-' + Date.now().toString(36) : null;
    club.short = String(club.short || 'MON').toUpperCase().slice(0, 4); club.logo.letters ??= club.short;
    this.data.club = club;
    this.data.squad = generateSquad('user-' + (club.customClubId || b.id), squad === 'own' ? rating - 6 : rating);
    if (squad === 'own') this.grant({ coins: 3000, tp: 600 });
    this.autoLineup(false);
    this.data.league = newLeague((this.data.league && this.data.league.season) || 1, club.country, club.baseClubId);
    this.data.tournaments = {}; this.data.clubChosen = true; this.data.clubMode = mode; this.data.squadMode = squad;
    this.save();
  }
  /** MON CLUB customisation after the choice: identity edited, squad / league / country kept. */
  updateClub(identity) {
    const c = this.data.club;
    for (const k of ['name', 'short', 'city', 'color', 'color2', 'color3', 'logo', 'kits', 'ball', 'pool']) if (identity[k] !== undefined) c[k] = JSON.parse(JSON.stringify(identity[k]));
    c.short = String(c.short).toUpperCase().slice(0, 4); c.customClubId ??= 'my-' + Date.now().toString(36);
    this.save();
  }
  // ------------------------------------------------ DÉFIS (challenges): best score, stars, first-time rewards
  challengeState(kind) { return this.data.challenges[kind] || { best: 0, stars: 0, plays: 0 }; }
  challengeStars(kind, made) {
    const D = DRILLS[kind]; if (D.steps) return made >= D.steps.length ? 3 : 0;
    return D.stars.filter((n) => made >= n).length;
  }
  /** Records a finished challenge; new stars pay 60 coins each, 3 stars the first time +5 gems, tutorial +200 coins. */
  recordChallenge(kind, made, total) {
    const prev = this.challengeState(kind), stars = this.challengeStars(kind, made), newStars = Math.max(0, stars - prev.stars);
    const reward = { coins: newStars * 60 };
    if (stars === 3 && prev.stars < 3) { if (kind === 'tutorial') { reward.coins += 200; reward.tp = 100; reward.medkits = 1; } else reward.gems = 5; }
    this.data.challenges[kind] = { best: Math.max(prev.best, made), stars: Math.max(prev.stars, stars), plays: prev.plays + 1, last: made };
    this.grant(reward); const levelUps = this.addXp(10 + made * 5); this.save();
    return { kind, made, total, stars, newStars, reward, levelUps, best: this.data.challenges[kind].best };
  }
  // ------------------------------------------------ change of championship (country) at the end of a season
  /** Allowed between two seasons: the championship is over and the new one has not started. */
  canChangeCountry() {   // (a rest round simulated for the other clubs does not close the window)
    const lg = this.data.league; return lg.season > 1 && !lg.rounds.some((r) => r.some((f) => f.hs !== null && (f.home === 'user' || f.away === 'user')));
  }
  /** Every national championship of the game: name, clubs, average rating. */
  leagueOptions() {
    return COUNTRY_LEAGUES.map((c) => { const cl = CLUBS.filter((x) => x.country === c && x.id !== this.data.club.baseClubId);
      return { country: c, name: (LEAGUES[c] || {}).game || c, clubs: cl.length + 1, avg: Math.round(cl.reduce((a, x) => a + x.rating, 0) / Math.max(1, cl.length)) }; });
  }
  /** Moves the club (squad, level, currencies, trophies kept) to the championship of another country. */
  changeCountry(code) {
    if (!this.canChangeCountry() || !COUNTRY_LEAGUES.includes(code) || code === this.data.club.country) return false;
    const c = this.data.club; c.country = code; c.customClubId ??= 'my-' + Date.now().toString(36);
    this.data.league = newLeague(this.data.league.season, code, c.baseClubId);
    this.save(); return true;
  }
  /** Saved custom club (MON CLUB), as stored in the local save. */
  customClub() {
    const c = this.data.club;
    return { customClubId: c.customClubId, baseClubId: c.baseClubId, name: c.name, shortName: c.short, city: c.city, country: c.country,
      colors: [c.color, c.color2, c.color3], logo: c.logo, homeKit: c.kits.home, awayKit: c.kits.away, capDesign: { cap: c.kits.home.cap, capTrim: c.kits.home.capTrim, number: c.kits.home.number }, ballDesign: c.ball, pool: c.pool };
  }
  /** Fictional budget of the club (career screen): from the club level, the results and the trophies. */
  budget() { const pr = this.data.profile; return 400000 + pr.level * 60000 + pr.wins * 15000 + pr.trophies.length * 250000; }

  // ------------------------------------------------ tournaments (national cups, continental, international)
  tournamentTeams(def) {
    const myBase = this.data.club.baseClubId;
    let pool = CLUBS.filter((c) => c.id !== myBase && (!def.countries || def.countries.includes(c.country)));
    pool.sort((a, b) => b.rating - a.rating);
    if (def.skipTop) pool = pool.slice(def.skipTop);
    let ids = ['user', ...pool.slice(0, def.size - 1).map((c) => c.id)];
    // knockout: power of two; groups: multiple of the group size
    if (def.format === 'ko') ids = ids.slice(0, 2 ** Math.floor(Math.log2(ids.length)));
    if (def.format === 'groups') ids = ids.slice(0, Math.max(def.groupSize, ids.length - (ids.length % def.groupSize)));
    return ids;
  }
  tournamentState(def) { const t = this.data.tournaments[def.id]; return t && t.season === this.data.league.season ? t : null; }
  tournamentStatus(def) {
    const pr = this.data.profile, t = this.tournamentState(def);
    if (def.minLevel && pr.level < def.minLevel) return 'LOCKED';
    if (!t) return 'AVAILABLE';
    if (t.stage === 'done') return t.champion === 'user' ? 'WON' : 'OUT';
    return 'ACTIVE';
  }
  startTournament(def) {
    const ids = this.tournamentTeams(def), rng = new Rng((Date.now() & 0xffffff) ^ def.id.length);
    for (let i = ids.length - 1; i > 1; i--) { const j = 1 + Math.floor(rng.f() * i); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const t = { id: def.id, season: this.data.league.season, stage: 'ko', round: 0, groups: [], ko: [], champion: null, log: [] };
    if (def.format === 'groups') {
      t.stage = 'groups';
      const per = def.groupSize || 4;
      for (let g = 0; g < ids.length / per; g++) {
        const gi = ids.slice(g * per, g * per + per), table = {};
        for (const id of gi) table[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
        t.groups.push({ ids: gi, rounds: roundRobin(gi), table });
      }
    } else if (def.format === 'league') {
      t.stage = 'league'; const table = {}; for (const id of ids) table[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      t.groups.push({ ids, rounds: roundRobin(ids), table });
    } else t.ko = [this.pairUp(ids)];
    this.data.tournaments[def.id] = t; this.save(); return t;
  }
  pairUp(ids) { const out = []; for (let i = 0; i < ids.length; i += 2) out.push({ a: ids[i], b: ids[i + 1], as: null, bs: null, winner: null }); return out; }
  koRoundName(n) { return n === 2 ? 'final' : n === 4 ? 'semi' : n === 8 ? 'quarter' : 'r16'; }
  /** The user's next match in a tournament: { opponent, label } or null. */
  nextTournamentMatch(def) {
    const t = this.tournamentState(def); if (!t || t.stage === 'done') return null;
    if (t.stage === 'groups' || t.stage === 'league') {
      const g = t.groups.find((x) => x.ids.includes('user')); if (t.round >= g.rounds.length) return null;
      const f = g.rounds[t.round].find((x) => x.home === 'user' || x.away === 'user');
      if (!f) return { opponent: null, bye: true, label: { kind: t.stage, n: t.round + 1, of: g.rounds.length } };
      return { opponent: f.home === 'user' ? f.away : f.home, label: { kind: t.stage, n: t.round + 1, of: g.rounds.length } };
    }
    const r = t.ko[t.ko.length - 1], m = r.find((x) => x.a === 'user' || x.b === 'user');
    return m && !m.winner ? { opponent: m.a === 'user' ? m.b : m.a, label: { kind: this.koRoundName(r.length * 2) } } : null;
  }
  simScore(home, away, rng, ko = false) {
    const th = this.clubInfo(home).total, ta = this.clubInfo(away).total;
    const goals = (atk, def) => { const lam = Math.max(1.5, 5 + (atk - def) * 0.18); let k = 0, p = Math.exp(-lam), s = p, u = rng.f(); while (u > s && k < 20) { k++; p *= lam / k; s += p; } return k; };
    let hs = goals(th, ta), as = goals(ta, th), pens = null;
    if (ko && hs === as) { pens = rng.f() < 0.5 + (th - ta) * 0.02 ? 'home' : 'away'; }
    return { hs, as, pens };
  }
  /** Records the user's result (hs = user goals) and plays the rest of the round. */
  playTournamentRound(def, hs, as) {
    const t = this.tournamentState(def), rng = new Rng((Date.now() & 0xffffff) + t.round * 7 + t.ko.length * 31), out = { def: def.id };
    const rec = (table, h, a, x, y) => { const H = table[h], A = table[a]; H.p++; A.p++; H.gf += x; H.ga += y; A.gf += y; A.ga += x;
      if (x > y) { H.w++; A.l++; H.pts += 3; } else if (x < y) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; } };
    if (t.stage === 'groups' || t.stage === 'league') {
      for (const g of t.groups) {
        for (const f of g.rounds[t.round] || []) {
          if (f.home === 'user' || f.away === 'user') { if (f.home === 'user') { f.hs = hs; f.as = as; } else { f.hs = as; f.as = hs; } }
          else { const r = this.simScore(f.home, f.away, rng); f.hs = r.hs; f.as = r.as; }
          rec(g.table, f.home, f.away, f.hs, f.as);
        }
      }
      t.round++;
      const rounds = Math.max(...t.groups.map((g) => g.rounds.length));
      if (t.round >= rounds) {
        const sorted = t.groups.map((g) => this.sortTable(g.table));
        if (t.stage === 'league') { t.stage = 'done'; t.champion = sorted[0][0]; }
        else {
          // top 2 of each group -> knockout (winners against runners-up of another group)
          const q = [], G = sorted.length; for (let g = 0; g < G; g++) q.push(sorted[g][0], sorted[(g + 1) % G][1]);
          t.stage = 'ko'; t.ko = [this.pairUp(q)]; out.qualified = q.includes('user');
          if (!out.qualified) { this.finishTournamentSim(t, rng); }
        }
      }
    } else {
      const r = t.ko[t.ko.length - 1];
      for (const m of r) {
        if (m.winner) continue;
        if (m.a === 'user' || m.b === 'user') {
          const mine = hs, theirs = as; let pens = null;
          if (mine === theirs) pens = rng.f() < 0.5 ? 'user' : 'opp';
          m.as = m.a === 'user' ? mine : theirs; m.bs = m.a === 'user' ? theirs : mine;
          m.winner = mine > theirs || pens === 'user' ? 'user' : m.a === 'user' ? m.b : m.a; m.pens = !!pens; out.pens = pens;
        } else { const x = this.simScore(m.a, m.b, rng, true); m.as = x.hs; m.bs = x.as; m.winner = x.hs > x.as || x.pens === 'home' ? m.a : m.b; m.pens = !!x.pens; }
      }
      out.eliminated = !r.some((m) => m.winner === 'user');
      if (r.length === 1) { t.stage = 'done'; t.champion = r[0].winner; }
      else if (out.eliminated) this.finishTournamentSim(t, rng);
      else t.ko.push(this.pairUp(r.map((m) => m.winner)));
    }
    if (t.stage === 'done') {
      out.champion = t.champion === 'user';
      if (out.champion) { this.data.profile.trophies.push({ name: def.id, season: t.season, date: Date.now() }); this.grant(def.reward); out.reward = def.reward; }
    }
    return out;
  }
  finishTournamentSim(t, rng) {
    if (t.stage !== 'ko') t.stage = 'ko';
    while (true) {
      const r = t.ko[t.ko.length - 1];
      for (const m of r) if (!m.winner) { const x = this.simScore(m.a, m.b, rng, true); m.as = x.hs; m.bs = x.as; m.winner = x.hs > x.as || x.pens === 'home' ? m.a : m.b; m.pens = !!x.pens; }
      if (r.length === 1) { t.stage = 'done'; t.champion = r[0].winner; return; }
      t.ko.push(this.pairUp(r.map((m) => m.winner)));
    }
  }
  sortTable(table) {
    return Object.entries(table).sort(([ia, a], [ib, b]) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || this.clubInfo(ia).name.localeCompare(this.clubInfo(ib).name)).map(([id]) => id);
  }

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
  // ------------------------------------------------ progression (training, quality, form, physique, trade)
  /** ENTRAÎNEMENT: training points -> +1 level = +1 on every stat, up to the cap of the quality tier. */
  upgradeCost(p) { return 60 + 40 * p.level; }
  upgrade(id) {
    const p = this.player(id), cost = this.upgradeCost(p), c = this.data.currencies;
    if (p.level >= maxLevel(p) || c.tp < cost) return false;
    c.tp -= cost;
    for (const k of STAT_KEYS) if (k !== 'goalkeeping' || p.role === 'GOALKEEPER') p.stats[k] = Math.min(99, p.stats[k] + 1);
    p.level++; this.save(); return true;
  }
  /** ENTRAÎNEMENT MAXIMAL: as many levels as the training points allow. Returns the levels gained. */
  upgradeMax(id) {
    const p = this.player(id); let n = 0;
    while (p.level < maxLevel(p) && this.data.currencies.tp >= this.upgradeCost(p)) { this.upgrade(id); n++; }
    return n;
  }
  /** AMÉLIORER LA QUALITÉ: at the level cap, one token of the current tier -> next tier, +2 all stats, skill level up. */
  qualityReady(p) { return (p.quality || 0) < QUALITIES.length - 1 && p.level >= maxLevel(p); }
  upgradeQuality(id) {
    const p = this.player(id), q = p.quality || 0, t = this.data.currencies.tokens;
    if (!this.qualityReady(p) || t[q] < 1) return false;
    t[q]--; p.quality = q + 1;
    for (const k of STAT_KEYS) if (k !== 'goalkeeping' || p.role === 'GOALKEEPER') p.stats[k] = Math.min(99, p.stats[k] + 2);
    const sk = p.skills.find((x) => x.level < 3 && (x.level > 0 || p.quality >= 2)); if (sk) sk.level++;
    this.save(); return true;
  }
  /** EN FORME POUR LE MATCH: a medical kit gives +50 form. */
  heal(id) {
    const p = this.player(id), c = this.data.currencies;
    if (p.form >= 100 || c.medkits < 1) return false;
    c.medkits--; p.form = Math.min(100, p.form + 50); this.save(); return true;
  }
  /** PHYSIQUE MAXIMAL: an energy drink = +4 speed, acceleration, stamina and physique for the next match. */
  energize(id) {
    const p = this.player(id), c = this.data.currencies;
    if (p.boost > 0 || c.energy < 1) return false;
    c.energy--; p.boost = 1; this.save(); return true;
  }
  /** ÉCHANGER: release players for training points (the 7 starters and a minimum squad of 9 are kept). */
  canTrade(id) { const L = this.lineup; return this.squad.length > 9 && L.gk !== id && !L.slots.includes(id); }
  trade(ids) {
    let tp = 0;
    for (const id of ids) {
      if (!this.canTrade(id)) continue;
      const p = this.player(id); tp += tradeValue(p);
      this.data.squad = this.squad.filter((x) => x.id !== id);
    }
    this.data.currencies.tp += tp; this.save(); return tp;
  }
  /** OBTENIR PLUS DE JOUEURS: scout a new player (coins), rating around the club level. */
  recruitCost() { return 800 + 200 * Math.min(10, this.data.recruits || 0); }
  recruit() {
    if (this.squad.length >= 18 || !this.spend({ coins: this.recruitCost() })) return null;
    const n = ++this.data.recruits, rng = new Rng((Date.now() ^ (n * 2654435761)) >>> 0);
    const roles = ['GOALKEEPER', 'CENTER', 'DEFENDER', 'WINGER', 'PLAYMAKER', 'FINISHER', 'ALL_ROUNDER'];
    const lvl = this.teamTotal().total, role = roles[Math.floor(rng.f() * roles.length)];
    const used = new Set(this.squad.map((p) => p.number));
    let num = 2; while (used.has(num)) num++;
    const p = makePlayer(rng, `r${Date.now().toString(36)}${n}`, role, lvl - 8 + Math.floor(rng.f() * 11), null, num);   // around the club level, rarely above
    this.squad.push(p); this.save(); return p;
  }

  // ------------------------------------------------ currencies
  canAfford(price) { const c = this.data.currencies; return (price.coins || 0) <= c.coins && (price.gems || 0) <= c.gems; }
  spend(price) {
    if (!this.canAfford(price)) return false;
    this.data.currencies.coins -= price.coins || 0; this.data.currencies.gems -= price.gems || 0; return true;
  }
  grant(r) {
    const c = this.data.currencies;
    c.coins += r.coins || 0; c.gems += r.gems || 0; c.tp += r.tp || 0; c.medkits += r.medkits || 0; c.energy += r.energy || 0;
    if (r.token !== undefined) c.tokens[r.token]++;
  }

  // ------------------------------------------------ XP / level
  xpForLevel(l) { return 400 + l * 100; }
  addXp(x) {
    const pr = this.data.profile; pr.xp += x; let ups = 0;
    while (pr.xp >= this.xpForLevel(pr.level)) { pr.xp -= this.xpForLevel(pr.level); pr.level++; ups++; }
    return ups;
  }

  // ------------------------------------------------ teams for the match engine
  clubInfo(id) {
    if (id === 'user') { const c = this.data.club; return { id: 'user', name: c.name, short: c.short, color: c.color, color2: c.color2, color3: c.color3, logo: c.logo, kits: c.kits, country: c.country, city: c.city, competition: this.data.league.name, total: this.teamTotal().total }; }
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
      const b = this.slotBonus(p, slot), ms = matchStats(p), stats = {};
      for (const k of STAT_KEYS) stats[k] = Math.max(1, Math.min(99, ms[k] + b));
      return { name: `${p.firstName[0]}. ${p.lastName}`, number: slot === -1 ? 1 : p.number, role: slot === -1 ? 'GOALKEEPER' : SLOT_ROLES[slot], personality: p.personality, stats, slot, playerId: p.id, look: lookOf(p) };
    };
    return { id: 'user', name: c.name, short: c.short, color: c.color, color2: c.color2, color3: c.color3, logo: c.logo, kits: c.kits, tactic: c.tactic, formation: c.formation,
      players: [toDef(this.player(L.gk), -1), ...L.slots.map((id, i) => toDef(this.player(id), i))] };
  }
  opponentTeamDef(id, rating) {
    const c = CLUBS.find((x) => x.id === id), sq = this.opponentSquad(id, rating).slice(0, 7);
    return { id, name: c.name, short: c.short, color: c.color, color2: c.color2, color3: c.color3, logo: c.logo, kits: c.kits, tactic: TACTICS[[...id].length % TACTICS.length],
      players: sq.map((p) => ({ name: `${p.firstName[0]}. ${p.lastName}`, number: p.number, role: p.role, personality: p.personality, stats: p.stats, slot: p.slot ?? -1, look: lookOf(p) })) };
  }

  // ------------------------------------------------ league
  /** Odd number of clubs: rounds where the user's club rests are simulated automatically. */
  skipRestRounds() {
    const lg = this.data.league; let n = 0;
    while (lg.round < lg.rounds.length && !lg.rounds[lg.round].some((f) => f.home === 'user' || f.away === 'user')) {
      const rng = new Rng((Date.now() & 0xffffff) + lg.round * 13);
      for (const f of lg.rounds[lg.round]) this.simulateFixture(f, rng);
      lg.round++; n++;
    }
    return n;
  }
  nextLeagueMatch() {
    const lg = this.data.league; if (this.skipRestRounds()) this.save(); if (lg.round >= lg.rounds.length) return null;
    const fx = lg.rounds[lg.round].find((f) => f.home === 'user' || f.away === 'user');
    const opp = fx.home === 'user' ? fx.away : fx.home;
    return { round: lg.round + 1, rounds: lg.rounds.length, opponent: opp, season: lg.season, home: fx.home === 'user' };
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
    const tp = Math.round((win ? 120 : draw ? 80 : 50) * mult), medkits = win && ctx.mode !== 'quick' ? 1 : 0;
    this.grant({ coins, tp, medkits });
    const levelUps = this.addXp(xp);
    const out = { coins, xp, tp, medkits, levelUps, objectives: [], event: null, league: null };
    // Players: career stats, form (starters tire, the bench recovers), PHYSIQUE boost used.
    const L = this.lineup, played = new Set([L.gk, ...L.slots]);
    for (const p of this.squad) {
      if (played.has(p.id)) {
        const c = p.career, st = (res.players || {})[p.id];
        c.matches++; if (win) c.wins++; else if (draw) c.draws++;
        if (st) for (const k of ['goals', 'assists', 'shots', 'steals', 'saves', 'passes']) c[k] += st[k] || 0;
        p.form = Math.max(0, p.form - 12); if (p.boost > 0) p.boost--;
      } else p.form = Math.min(100, p.form + 15);
    }

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
      lg.round++; this.skipRestRounds();
      const pos = this.standings().findIndex((r) => r.id === 'user') + 1;
      out.league = { position: pos, finished: lg.round >= lg.rounds.length };
      if (out.league.finished) {
        lg.champion = this.standings()[0].id;
        if (lg.champion === 'user') { pr.trophies.push({ name: 'league', season: lg.season, date: Date.now() }); this.grant({ coins: 1000, gems: 25, token: 2 }); out.league.champion = true; }
        this.data.league = newLeague(lg.season + 1, this.data.club.country, this.data.club.baseClubId);
        this.data.lastSeason = { season: lg.season, country: lg.country, position: out.league.position, champion: !!out.league.champion };
        out.league.canMove = true;   // end of the championship: the club may move to another country's league
      }
    }
    // Tournament
    if (ctx.mode === 'tournament') {
      const def = TOURNAMENTS.find((d) => d.id === ctx.tournamentId);
      out.tournament = this.playTournamentRound(def, res.hs, res.as);
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

export { STAT_KEYS, N, makePlayer };
