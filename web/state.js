// WATER POLO 26 MOBILE — game state & data layer (web build).
// Every number shown by the UI comes from here and is saved on the device (localStorage).
// Clubs, players and competitions are FICTIONAL: no licence is held for real names, logos or
// photos (see docs/UI.md). Real data can be plugged in later through the same structures,
// with `source` / `lastUpdated` fields filled from official sources.
import { Rng, N, TACTICS, DRILLS } from './sim.js';
import { WORLD_COUNTRIES, REAL_CLUBS, LEAGUES as W_LEAGUES, CONTINENT_INFO, clubById, countryOf, countryClubs, reserveClub, divisionName, applyMoves, continentalPlaces, DIVS } from './world.js';
export { WORLD_COUNTRIES, CONTINENT_INFO, clubById, countryOf, countryClubs, divisionName, DIVS };

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
export const LEAGUES = W_LEAGUES;
export const CLUBS = REAL_CLUBS;
/** Every country of the career world (5 divisions × 9 clubs each, see web/world.js). */
export const COUNTRY_LEAGUES = WORLD_COUNTRIES.map((c) => c.code);
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
/** National cup of any country (the user's country cup is always listed). */
export function nationalCup(c) {
  const bg = { FRA: ['#1f4fd6', '#0b1d5c'], ITA: ['#0f9a58', '#064326'], ESP: ['#d4202b', '#5e0a10'], HUN: ['#2f8a4c', '#0f3a1e'], GRE: ['#1d7ad6', '#0a2f63'], CRO: ['#d6303a', '#3a1a6e'] }[c] || ['#2f5bd8', '#10204f'];
  const ct = countryOf(c);
  return { id: 'cup-' + c, scope: 'national', country: c, countries: [c], name: `Coupe ${FLAG_NAMES[c] || (ct ? ct.fr : c)}`, format: 'ko', size: 8, reward: { coins: 700, gems: 8, token: 1 }, inspiredBy: 'national cup', art: 'goblet', bg };
}
const EURO = { continent: 'EUR', qualify: true };
// Continental competitions: entry by qualification (Division 1, see the end of season); reference names of the
// European club system kept apart, adapted names shown in the game.
export const TOURNAMENTS = [
  ...['FRA', 'ITA', 'ESP', 'HUN', 'GRE', 'CRO'].map(nationalCup),
  { id: 'adria', scope: 'regional', name: 'Adria League', countries: ['CRO', 'SRB', 'MNE', 'SLO'], format: 'league', size: 6, reward: { coins: 900, gems: 12, token: 1 }, minLevel: 2, inspiredBy: 'regional league (Adriatic)', art: 'wave', bg: ['#14b7c9', '#0a4a66'] },
  { id: 'med-cup', scope: 'regional', name: 'Mediterranean Club Cup', countries: ['FRA', 'ITA', 'ESP', 'GRE', 'CRO', 'MLT', 'TUR', 'MNE'], format: 'groups', groupSize: 4, size: 8, reward: { coins: 1400, gems: 18, token: 2 }, minLevel: 4, inspiredBy: 'Mediterranean club tournaments', art: 'plate', bg: ['#0aa37a', '#053d34'] },
  { id: 'euro-champions', scope: 'continental', ...EURO, officialReferenceName: 'European Aquatics Champions League', name: 'Euro Champions Aqua', format: 'groups', groupSize: 4, size: 16, reward: { coins: 2500, gems: 30, token: 3 }, art: 'bigear', bg: ['#2b2fb8', '#0a0d3e'] },
  { id: 'euro-challenge', scope: 'continental', ...EURO, officialReferenceName: 'European Aquatics Euro Cup', name: 'Euro Challenge Cup', format: 'ko', size: 8, skipTop: 12, reward: { coins: 1500, gems: 18, token: 2 }, art: 'tower', bg: ['#e2541c', '#4a0c08'] },
  { id: 'euro-conference', scope: 'continental', ...EURO, officialReferenceName: 'European Aquatics Conference Cup', name: 'Euro Conference Aqua', format: 'ko', size: 8, skipTop: 24, reward: { coins: 1100, gems: 12, token: 1 }, art: 'goblet', bg: ['#0f9a8a', '#06403a'] },
  { id: 'euro-challenger', scope: 'continental', ...EURO, officialReferenceName: 'European Aquatics Challenger Cup', name: 'Euro Challenger Aqua', format: 'ko', size: 8, skipTop: 40, reward: { coins: 800, gems: 8, token: 1 }, art: 'wave', bg: ['#6b7a8f', '#222a36'] },
  { id: 'euro-super', scope: 'continental', continent: 'EUR', officialReferenceName: 'European Aquatics Super Cup', name: 'Euro Super Aqua', format: 'ko', size: 2, reward: { coins: 1500, gems: 20, token: 2 }, requiresTrophy: ['euro-champions', 'euro-challenge'], lastSeason: true, art: 'plate', bg: ['#c9a227', '#4a3a08'] },
  ...[['AME', 'americas-cup', 'Americas Aqua Cup', ['#1d8a4e', '#0a3a20']], ['ASI', 'asia-cup', 'Asia Aqua Cup', ['#d4202b', '#4a0a10']], ['AFR', 'africa-cup', 'Africa Aqua Cup', ['#e0a020', '#5a3a06']], ['OCE', 'oceania-cup', 'Oceania Aqua Cup', ['#1d7ad6', '#0a2f63']]]
    .map(([continent, id, name, bg]) => ({ id, scope: 'continental', continent, qualify: true, name, format: 'ko', size: 8, reward: { coins: 1500, gems: 18, token: 2 }, art: 'goblet', bg })),
  { id: 'world-masters', scope: 'international', name: 'World Club Masters', format: 'ko', size: 8, reward: { coins: 3000, gems: 40, token: 3 }, requiresTrophy: ['euro-champions', 'euro-challenge', 'euro-conference', 'euro-challenger', 'americas-cup', 'asia-cup', 'africa-cup', 'oceania-cup'], inspiredBy: 'international club tournaments', art: 'globe', bg: ['#f2a516', '#7a3c00'] },
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
// ---------------------------------------------------------------- reward packs
/**
 * 4 pack levels, earned at the end of EVERY match (never sold): the result decides the level.
 * Each card of a pack is a real resource of the game (coins, gems, training points, medical kits,
 * energy drinks, quality tokens, a new player). Ranges are [min, max].
 */
export const PACK_TIERS = [
  // player: [min, max] rating of the pack player relative to the club TOTAL (+ its card quality)
  { id: 'bronze', coins: [120, 200], tp: [40, 80], extra: 1, player: [-14, -6] },
  { id: 'silver', coins: [220, 320], tp: [80, 140], gems: [1, 2], medkits: 1, extra: 1, player: [-10, -2] },
  { id: 'gold', coins: [380, 520], tp: [140, 220], gems: [3, 5], medkits: 1, extra: 1, token: 0, player: [-6, 2] },
  { id: 'elite', coins: [650, 900], tp: [250, 350], gems: [6, 10], medkits: 2, energy: 1, token: 1, player: [-2, 6] },
];
export const PACK_SLOTS = 4;
/** Pack level of a match: defeat → bronze, draw → silver, win → gold, win by 3+ goals → elite;
 *  a won tournament / playoff match goes up one level; a quick match gives at most silver. */
export function packTier(mode, hs, as) {
  let t = hs > as ? 2 : hs === as ? 1 : 0;
  if (hs - as >= 3) t = 3;
  if (hs > as && (mode === 'tournament' || mode === 'playoff')) t = Math.min(3, t + 1);
  if (mode === 'quick') t = Math.min(1, t);
  return t;
}

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
/** Home and away: the single round robin, then the same rounds with home / away swapped. */
function doubleRoundRobin(ids) { const one = roundRobin(ids); return [...one, ...one.map((r) => r.map((f) => ({ home: f.away, away: f.home, hs: null, as: null })))]; }
const emptyRow = () => ({ p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
function recordInto(table, h, a, x, y) {
  const H = table[h], A = table[a]; H.p++; A.p++; H.gf += x; H.ga += y; A.gf += y; A.ga += x;
  if (x > y) { H.w++; A.l++; H.pts += 3; } else if (x < y) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
}
/** Championship of one division: the 9 clubs of the division + the user's club, home and away. */
function newLeague(season, country, division, aiIds) {
  const ids = ['user', ...aiIds], table = {}; for (const id of ids) table[id] = emptyRow();
  return { season, country, division, round: 0, rounds: doubleRoundRobin(ids), table, champion: null, name: divisionName(country, division) };
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
    league: newLeague(1, 'FRA', 1, countryClubs('FRA').divisions[0]),
    career: { country: 'FRA', division: 1 }, world: {}, careerHistory: [], seasonEnd: null, continental: null,
    events: {},
    objectives: { day: '', list: [] },
    gift: { lastDay: '', streak: 0 },
    packs: { slots: [], fresh: null, seq: 0, opened: 0 },
  };
}

export class GameState {
  constructor() {
    this.listeners = new Set();
    this.data = this.load();
    if (!this.data.league) this.data.league = this.makeLeague(1, this.data.career.country, this.data.career.division);
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
        // Saves made before the 5-division world: career in division 1 of the club's country.
        raw.career ??= { country: countryOf(cl.country) ? cl.country : 'FRA', division: 1 }; raw.world ??= {}; raw.careerHistory ??= []; raw.seasonEnd ??= null; raw.continental ??= null;
        raw.packs ??= { slots: [], fresh: null, seq: 0, opened: 0 };
        if (!raw.league.division || Object.keys(raw.league.table).some((id) => id !== 'user' && !clubById(id))) raw.league = null;   // rebuilt by the constructor
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
  baseClub(id) { return clubById(id); }

  // ------------------------------------------------ world: 5 divisions × 9 clubs per country (+ the user's club)
  /** Divisions of a country as they evolve in this career (promotions); the user's base club is replaced. */
  worldState(code) {
    let w = this.data.world[code];
    if (!w) {
      w = this.data.world[code] = { divisions: countryClubs(code).divisions.map((d) => d.slice()), reserve: 0, continental: null };
      const base = this.data.club.baseClubId;
      w.divisions.forEach((d, i) => { const k = d.indexOf(base); if (k >= 0) d[k] = reserveClub(code, i + 1, w.reserve++); });
    }
    return w;
  }
  divisionIds(code, d) { return this.worldState(code).divisions[d - 1]; }
  /** Division (1..5) of a club at the start of a career in its country. */
  startDivision(id) { const c = clubById(id); if (!c) return DIVS; const k = countryClubs(c.country).divisions.findIndex((d) => d.includes(id)); return k >= 0 ? k + 1 : DIVS; }
  makeLeague(season, code, d) { return newLeague(season, code, d, this.divisionIds(code, d)); }
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
  chooseClub(identity, { mode = 'with', squad = 'start', division } = {}) {
    const b = identity.baseClubId ? this.baseClub(identity.baseClubId) : null;
    const country = countryOf(identity.country) ? identity.country : b ? b.country : 'FRA', div = division || (b ? this.startDivision(b.id) : DIVS);
    const avg = Math.round(countryClubs(country).divisions[div - 1].reduce((a, id) => a + clubById(id).rating, 0) / 9), rating = b ? b.rating - 2 : avg - 2;
    const club = { ...defaultState().club, ...identity, tactic: identity.tactic || 'BALANCED', createdAt: Date.now() };
    club.customClubId = mode === 'version' || !b ? 'my-' + Date.now().toString(36) : null;
    club.short = String(club.short || 'MON').toUpperCase().slice(0, 4); club.logo.letters ??= club.short;
    this.data.club = club;
    this.data.squad = generateSquad('user-' + (club.customClubId || b.id), squad === 'own' ? rating - 6 : rating);
    if (squad === 'own') this.grant({ coins: 3000, tp: 600 });
    this.autoLineup(false);
    club.country = country; this.data.career = { country, division: div }; this.data.world = {}; this.data.seasonEnd = null; this.data.continental = null;
    this.data.league = this.makeLeague((this.data.league && this.data.league.season) || 1, country, div);
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
    const lg = this.data.league; return lg.season > 1 && !this.pendingPlayoff() && !lg.rounds.some((r) => r.some((f) => f.hs !== null && (f.home === 'user' || f.away === 'user')));
  }
  /** Every national championship of the game: name, clubs, average rating. */
  leagueOptions() {
    const d = this.data.career.division;
    return WORLD_COUNTRIES.map((ct) => { const ids = ct.code === this.data.career.country ? this.divisionIds(ct.code, d) : countryClubs(ct.code).divisions[d - 1];
      return { country: ct.code, continent: ct.continent, name: divisionName(ct.code, d), clubs: ids.length + 1, avg: Math.round(ids.reduce((a, id) => a + clubById(id).rating, 0) / ids.length) }; });
  }
  /** Moves the club (squad, level, currencies, trophies kept) to the championship of another country. */
  changeCountry(code) {
    if (!this.canChangeCountry() || !COUNTRY_LEAGUES.includes(code) || code === this.data.club.country) return false;
    const c = this.data.club; c.country = code; c.customClubId ??= 'my-' + Date.now().toString(36);
    this.data.career.country = code;   // same division level in the new country
    this.data.league = this.makeLeague(this.data.league.season, code, this.data.career.division);
    this.save(); return true;
  }
  // ------------------------------------------------ end of season: playoffs, promotions, continental places
  /** The user's playoff match if one is pending: { opponent, kind: 'promotion' | 'continental', home }. */
  pendingPlayoff() {
    const se = this.data.seasonEnd; if (!se || se.stage !== 'playoff') return null;
    const p = se.playoff; return { opponent: p.a === 'user' ? p.b : p.a, kind: p.kind, home: p.a === 'user', season: se.season, division: se.division };
  }
  /** Final ranking of the user's division; the 2nd v 3rd match is played by the user if involved, else simulated. */
  startSeasonEnd(rng) {
    const lg = this.data.league, R = this.sortTable(lg.table);
    this.data.seasonEnd = { stage: 'playoff', season: lg.season, country: lg.country, division: lg.division, ranking: R, table: JSON.parse(JSON.stringify(lg.table)),
      playoff: { a: R[1], b: R[2], as: null, bs: null, winner: null, pens: false, kind: lg.division === 1 ? 'continental' : 'promotion' } };
    if (R[1] === 'user' || R[2] === 'user') return true;
    const p = this.data.seasonEnd.playoff, x = this.simScore(p.a, p.b, rng, true);
    p.as = x.hs; p.bs = x.as; p.pens = !!x.pens; p.winner = x.hs > x.as || x.pens === 'home' ? p.a : p.b;
    this.finalizeSeason(rng); return false;
  }
  /** Simulated season of a division (home and away). */
  simDivision(ids, rng) {
    const table = {}; for (const id of ids) table[id] = emptyRow();
    for (const r of doubleRoundRobin(ids)) for (const f of r) { const x = this.simScore(f.home, f.away, rng); recordInto(table, f.home, f.away, x.hs, x.as); }
    return table;
  }
  /**
   * End of season of the user's country: every division ranked (the user's one played, the others simulated),
   * 2nd v 3rd playoffs, promotions (1st + playoff winner) with the matching moves down (9 AI clubs per division
   * kept, the user's club is never relegated), Division 1 champion and continental places, history, new season.
   */
  finalizeSeason(rng) {
    const se = this.data.seasonEnd, code = se.country, W = this.worldState(code), d0 = se.division, pr = this.data.profile;
    const rankings = [], playoffs = [], tables = [];
    for (let d = 1; d <= DIVS; d++) {
      if (d === d0) { rankings.push(se.ranking); playoffs.push(se.playoff); tables.push(se.table); continue; }
      const t = this.simDivision(W.divisions[d - 1], rng), r = this.sortTable(t), x = this.simScore(r[1], r[2], rng, true);
      rankings.push(r); tables.push(t); playoffs.push({ a: r[1], b: r[2], as: x.hs, bs: x.as, pens: !!x.pens, winner: x.hs > x.as || x.pens === 'home' ? r[1] : r[2], kind: d === 1 ? 'continental' : 'promotion' });
    }
    const moves = applyMoves(W.divisions, rankings, playoffs, d0), places = continentalPlaces(code, rankings[0], playoffs[0]);
    W.divisions = moves.divisions; W.continental = { season: se.season + 1, places };
    const mine = places.find((p) => p.id === 'user'), pos = se.ranking.indexOf('user') + 1, promoted = moves.userTo < d0, champion = d0 === 1 && pos === 1;
    this.data.continental = mine ? { season: se.season + 1, competition: mine.competition, seed: mine.seed, country: code } : null;
    const reward = {};
    const add = (r) => { for (const k in r) reward[k] = (reward[k] || 0) + r[k]; };
    if (champion) { pr.trophies.push({ name: 'league', season: se.season, date: Date.now() }); add({ coins: 1000, gems: 25, token: 2 }); }
    else if (pos === 1) { pr.trophies.push({ name: 'division' + d0, season: se.season, date: Date.now() }); add({ coins: 400, gems: 5 }); }
    if (promoted) { pr.trophies.push({ name: 'promotion' + d0, season: se.season, date: Date.now() }); add({ coins: 500, gems: 10, token: 1 }); }
    if (mine) add({ coins: 300, gems: 5 });
    this.grant(reward);
    this.addPack(champion || promoted ? 3 : pos <= 3 ? 2 : 1, 'season');   // PACK DE SAISON
    const summary = { season: se.season, country: code, division: d0, divisionName: divisionName(code, d0), newDivision: moves.userTo, newDivisionName: divisionName(code, moves.userTo),
      table: se.table, ranking: se.ranking, position: pos, playoff: se.playoff, promoted: d0 > 1 ? moves.promoted[d0] : null, relegated: moves.relegated[d0] || [],
      champion: rankings[0][0], continental: d0 === 1 ? places : null, myPlace: mine || null, userPromoted: promoted, userChampion: champion, reward,
      divisions: rankings.map((r, i) => ({ division: i + 1, name: divisionName(code, i + 1), first: r[0], up: i > 0 ? moves.promoted[i + 1] : null })) };
    this.data.careerHistory.push({ season: se.season, country: code, division: d0, position: pos, promoted, champion, continental: mine ? mine.competition : null });
    this.data.career.division = moves.userTo;
    this.data.league = this.makeLeague(se.season + 1, code, moves.userTo);
    this.data.lastSeason = { season: se.season, country: code, position: pos, champion };
    this.data.seasonEnd = { stage: 'done', summary, seen: false };
    this.save();
    return summary;
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
  /** Competitions shown to the user: the national cup of the user's country first. */
  tournamentList() { const my = this.data.career.country; return [nationalCup(my), ...TOURNAMENTS.filter((d) => d.id !== 'cup-' + my)]; }
  tournamentDef(id) { return this.tournamentList().find((d) => d.id === id) || (id && id.startsWith('cup-') ? nationalCup(id.slice(4)) : null); }
  /** Division 1 of a country (as it evolves in this career for the user's country). */
  topDivision(code) { return code === this.data.career.country ? this.divisionIds(code, 1) : countryClubs(code).divisions[0]; }
  tournamentTeams(def) {
    const myBase = this.data.club.baseClubId, W = WORLD_COUNTRIES;
    let ids;
    if (def.scope === 'national') { const w = def.country === this.data.career.country ? this.worldState(def.country).divisions : countryClubs(def.country).divisions; ids = [...w[0], ...w[1]]; }
    else if (def.countries) ids = def.countries.flatMap((c) => this.topDivision(c));
    else if (def.continent) ids = W.filter((c) => c.continent === def.continent).flatMap((c) => this.topDivision(c.code));
    else ids = W.filter((c) => c.level >= 3).flatMap((c) => this.topDivision(c.code));
    let pool = [...new Set(ids)].filter((id) => id !== myBase).map((id) => clubById(id));
    pool.sort((a, b) => b.rating - a.rating);
    if (def.skipTop) pool = pool.slice(def.skipTop);
    ids = ['user', ...pool.slice(0, def.size - 1).map((c) => c.id)];
    // knockout: power of two; groups: multiple of the group size
    if (def.format === 'ko') ids = ids.slice(0, 2 ** Math.floor(Math.log2(ids.length)));
    if (def.format === 'groups') ids = ids.slice(0, Math.max(def.groupSize, ids.length - (ids.length % def.groupSize)));
    return ids;
  }
  tournamentState(def) { const t = this.data.tournaments[def.id]; return t && t.season === this.data.league.season ? t : null; }
  /** Why a competition is locked (null = open): continental qualification, trophy, level, other country. */
  tournamentLock(def) {
    const pr = this.data.profile, q = this.data.continental, season = this.data.league.season;
    if (def.scope === 'national' && def.country !== this.data.career.country) return { why: 'country', country: def.country };
    if (def.scope === 'regional' && !def.countries.includes(this.data.career.country)) return { why: 'region' };
    if (def.qualify && !(q && q.competition === def.id && q.season === season)) return { why: 'qualify' };
    if (def.requiresTrophy && !pr.trophies.some((t) => def.requiresTrophy.includes(t.name) && (!def.lastSeason || t.season === season - 1))) return { why: 'trophy' };
    if (def.minLevel && pr.level < def.minLevel) return { why: 'level', level: def.minLevel };
    return null;
  }
  tournamentStatus(def) {
    const t = this.tournamentState(def);
    if (this.tournamentLock(def)) return 'LOCKED';
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

  // ------------------------------------------------ reward packs
  /** New pack: into a free slot (4), otherwise it must be opened now (`fresh`). */
  addPack(tier, source = 'match') {
    const P = this.data.packs, pack = { id: ++P.seq, tier, source, seed: (Date.now() ^ Math.imul(P.seq, 2654435761)) >>> 0 };
    if (P.slots.length < PACK_SLOTS) P.slots.push(pack);
    else { if (P.fresh) this.openPack(P.fresh.id); P.fresh = pack; }
    return pack;
  }
  findPack(id) { const P = this.data.packs; return P.slots.find((p) => p.id === id) || (P.fresh && P.fresh.id === id ? P.fresh : null); }
  /** Opens a pack: draws its cards (deterministic from its seed), grants them, frees the slot. */
  openPack(id) {
    const P = this.data.packs, pack = this.findPack(id); if (!pack) return null;
    const T = PACK_TIERS[pack.tier], rng = new Rng(pack.seed), roll = ([a, b]) => Math.round(a + (b - a) * rng.f());
    const cards = [{ kind: 'coins', n: roll(T.coins) }, { kind: 'tp', n: roll(T.tp) }];
    if (T.gems) cards.push({ kind: 'gems', n: roll(T.gems) });
    if (T.medkits) cards.push({ kind: 'medkits', n: T.medkits });
    if (T.energy) cards.push({ kind: 'energy', n: T.energy });
    if (T.extra) cards.push(rng.f() < 0.5 ? { kind: 'medkits', n: 1 } : { kind: 'energy', n: 1 });
    if (T.token !== undefined) cards.push({ kind: 'token', q: T.token, n: 1 });
    if (T.player) {   // every pack has a player, more or less strong depending on the pack level
      const p = this.packPlayer(rng, pack.id, T.player, pack.tier);
      if (this.squad.length < 18) { this.squad.push(p); cards.push({ kind: 'player', id: p.id }); }
      else cards.push({ kind: 'converted', n: tradeValue(p), ovr: overall(p) });   // full squad (18): released for training points
    }
    const merged = [];   // same resource twice -> one card
    for (const c of cards) { const m = c.kind !== 'player' && c.kind !== 'converted' && merged.find((x) => x.kind === c.kind && x.q === c.q); if (m) m.n += c.n; else merged.push(c); }
    for (const c of merged) if (c.kind === 'token') this.data.currencies.tokens[c.q] += c.n; else if (c.kind === 'converted') this.grant({ tp: c.n }); else if (c.kind !== 'player') this.grant({ [c.kind]: c.n });
    P.slots = P.slots.filter((p) => p !== pack); if (P.fresh === pack) P.fresh = null;
    P.opened++; this.save();
    return { tier: pack.tier, source: pack.source, cards: merged };
  }
  /** Pack player: rating drawn in the tier range around the club TOTAL (1 in 10 is a nugget: +4), card quality = pack level. */
  packPlayer(rng, n, [lo, hi], tier) {
    const roles = ['GOALKEEPER', 'CENTER', 'DEFENDER', 'WINGER', 'PLAYMAKER', 'FINISHER', 'ALL_ROUNDER'];
    const used = new Set(this.squad.map((p) => p.number)); let num = 2; while (used.has(num)) num++;
    const nugget = rng.f() < 0.1, r = this.teamTotal().total + lo + Math.floor(rng.f() * (hi - lo + 1)) + (nugget ? 4 : 0);
    const p = makePlayer(rng, `pk${n}${Date.now().toString(36)}`, roles[Math.floor(rng.f() * roles.length)], Math.min(97, r), null, num);
    p.quality = tier; return p;
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
    const c = clubById(id);
    return { ...c, total: this.opponentTotal(id) };
  }
  opponentSquad(id, rating) { const c = clubById(id); return generateSquad(id, rating ?? c.rating); }
  opponentTotal(id, rating) {
    const key = id + '|' + (rating ?? ''); this._tot ??= new Map(); if (this._tot.has(key)) return this._tot.get(key);
    const v = this.opponentTotal0(id, rating); this._tot.set(key, v); return v;
  }
  opponentTotal0(id, rating) {
    const sq = this.opponentSquad(id, rating);
    return Math.round(sq.slice(0, 7).reduce((a, p) => a + overall(p) + this.slotBonus(p, p.slot ?? -1), 0) / 7);
  }
  /** Team definition for sim.js Match (stats include the real position bonus). */
  /** Match definition of one squad player in a slot (stats with form, skills and the position bonus). */
  playerDef(p, slot) {
    const b = this.slotBonus(p, slot), ms = matchStats(p), stats = {};
    for (const k of STAT_KEYS) stats[k] = Math.max(1, Math.min(99, ms[k] + b));
    return { name: `${p.firstName[0]}. ${p.lastName}`, number: slot === -1 ? 1 : p.number, role: slot === -1 ? 'GOALKEEPER' : SLOT_ROLES[slot], personality: p.personality, stats, slot, playerId: p.id, look: lookOf(p) };
  }
  userTeamDef() {
    const L = this.lineup, c = this.data.club;
    const toDef = (p, slot) => this.playerDef(p, slot);
    return { id: 'user', name: c.name, short: c.short, color: c.color, color2: c.color2, color3: c.color3, logo: c.logo, kits: c.kits, tactic: c.tactic, formation: c.formation,
      players: [toDef(this.player(L.gk), -1), ...L.slots.map((id, i) => toDef(this.player(id), i))] };
  }
  opponentTeamDef(id, rating) {
    const c = clubById(id), sq = this.opponentSquad(id, rating).slice(0, 7);
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
        lg.champion = this.standings()[0].id; out.league.champion = lg.champion === 'user' && lg.division === 1;
        out.league.playoff = this.startSeasonEnd(rng);   // 2nd v 3rd (the user plays it if involved), then moves
        if (!out.league.playoff) { out.season = this.data.seasonEnd.summary; out.league.canMove = true; }
      }
    }
    // Playoff (2nd v 3rd): promotion (divisions 2-5) or continental place (division 1)
    if (ctx.mode === 'playoff' && this.data.seasonEnd && this.data.seasonEnd.stage === 'playoff') {
      const p = this.data.seasonEnd.playoff, userA = p.a === 'user', rng = new Rng((Date.now() & 0xffffff) ^ 0x5eed);
      const pens = res.hs === res.as ? (rng.f() < 0.5 ? 'user' : 'opp') : null, won = res.hs > res.as || pens === 'user';
      p.as = userA ? res.hs : res.as; p.bs = userA ? res.as : res.hs; p.pens = !!pens; p.winner = won ? 'user' : userA ? p.b : p.a;
      out.playoff = { ...p, won }; this.finalizeSeason(rng); out.season = this.data.seasonEnd.summary; out.league = { canMove: true };
    }
    // Tournament
    if (ctx.mode === 'tournament') {
      const def = this.tournamentDef(ctx.tournamentId);
      out.tournament = this.playTournamentRound(def, res.hs, res.as);
    }
    // Event
    if (ctx.mode === 'event') {
      const ev = EVENTS.find((e) => e.id === ctx.eventId), st = this.eventState(ev);
      const progress = win ? st.progress + 1 : st.progress;
      this.data.events[ev.id] = { cycle: st.cycle, progress, claimed: false };
      out.event = { id: ev.id, progress, total: ev.matches, won: win };
    }
    // Reward pack of the match (4 levels)
    out.pack = this.addPack(packTier(ctx.mode, res.hs, res.as), 'match');
    pr.history.unshift({ date: Date.now(), mode: ctx.mode, opponent: ctx.opponent, hs: res.hs, as: res.as });
    pr.history.length = Math.min(pr.history.length, 20);
    this.save();
    return out;
  }
}

export { STAT_KEYS, N, makePlayer };
