// WATER POLO 26 — career world: every country has 5 divisions of 9 clubs (+ the user's club as a 10th
// team in its division). This 5 × 9 pyramid is a STANDARDISED GAMEPLAY STRUCTURE, not the official
// structure of the countries' championships.
//  - REAL clubs (web/data/clubs.json: reference data + sources, adapted game identity) are placed first,
//    strongest at the top.
//  - Every other place is a club CREATED BY THE GAME (gameCreated: true, verified: false, no source):
//    original name built on a real city of the country + a generic nickname; never presented as a real club.
import CLUB_DB from './data/clubs.js';
import { COUNTRY_LIST, DIVISION_NAMES, CONTINENTS, SLOTS_BY_LEVEL } from './data/world.js';

export const DIVS = 5, PER_DIV = 9;
const hash = (s) => [...String(s)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
const emoji = (iso2) => (/^[A-Z]{2}$/.test(iso2) && iso2 !== 'XK' ? String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🏳️');

export const LEAGUES = CLUB_DB.leagues;
export const CONTINENT_INFO = CONTINENTS;
/** Countries of the world with their continental data (continentalCompetition / Slots / Rules). */
export const WORLD_COUNTRIES = COUNTRY_LIST.map(([code, iso2, fr, en, continent, level, cities]) => {
  const slots = (SLOTS_BY_LEVEL[continent] || {})[level] || (level >= 3 ? [CONTINENTS[continent].competitions[0], CONTINENTS[continent].competitions[0]] : [CONTINENTS[continent].competitions[0]]);
  return { code, iso2, fr, en, continent, level, cities, flag: emoji(iso2),
    continentalCompetition: CONTINENTS[continent].competitions[0], continentalQualificationSlots: slots,
    continentalQualificationRules: 'D1 : 1er → place 1 ; vainqueur du match 2e contre 3e → place 2 ; perdant → place 3 ; puis 4e, 5e… selon le nombre de places' };
});
const BY_CODE = new Map(WORLD_COUNTRIES.map((c) => [c.code, c]));
export const countryOf = (code) => BY_CODE.get(code) || null;
export const divisionName = (code, d) => (DIVISION_NAMES[code] || [])[d - 1] || `Division ${d}`;
export const officialCompetitionName = (code, d) => (d === 1 && LEAGUES[code] ? LEAGUES[code].official : null);

// ---------------------------------------------------------------- identities
const SHAPES = ['shield', 'circle', 'hex', 'roundel', 'diamond', 'pennant'], SYMBOLS = ['wave', 'ball', 'trident', 'fin', 'star', 'goal', 'drop', 'letters'];
const PATTERNS = ['plain', 'halves', 'stripe', 'sash', 'plain', 'chevron'];
const COLORS = [0x1e5bd8, 0x0f4c81, 0x13c4e8, 0x1f8a70, 0x2fbf71, 0xf2c81a, 0xf28c1a, 0xd8321e, 0xb81e5a, 0x7a2fd0, 0x16181d, 0x8a1538, 0x0b2348, 0x5f6b7a];
const NICK = ['Aqua', 'Sharks', 'Dolphins', 'Waves', 'Tritons', 'Orcas', 'Marlins', 'Barracudas', 'Stingrays', 'Swordfish', 'Seals', 'Otters', 'Riptide', 'Mariners', 'Torpedo', 'Neptune', 'Blue Wave', 'Pirates'];
function kitsFor(colors, h) {
  return { home: { suit: colors[0], suit2: colors[1], pattern: PATTERNS[(h >>> 9) % PATTERNS.length], cap: colors[0], capTrim: colors[1], number: colors[1] },
    away: { suit: colors[1], suit2: colors[0], pattern: PATTERNS[(h >>> 12) % PATTERNS.length], cap: 0xf4f6f8, capTrim: colors[0], number: colors[0] },
    goalkeeper: { cap: 0xd81a1f, capTrim: 0xffffff, number: 0xffffff } };
}
const derived = (rating, h) => ({ attackRating: rating + ((h >>> 3) % 7) - 3, defenseRating: rating + ((h >>> 6) % 7) - 3, goalkeeperRating: rating + ((h >>> 9) % 7) - 3, prestige: Math.max(1, Math.min(5, Math.round((rating - 50) / 8))) });

/** Real clubs (reference data kept apart, adapted game identity). */
export const REAL_CLUBS = CLUB_DB.clubs.map((c) => ({
  id: c.id, name: c.gameClubName, short: c.shortName, color: c.colors[0], color2: c.colors[1], color3: c.colors[2], rating: c.rating, ...derived(c.rating, hash(c.id)),
  logo: c.logo, kits: c.kits, country: c.country, city: c.city, competition: c.gameCompetition, stadium: null, gameCreated: false, verified: true,
  ref: { officialReferenceName: c.officialReferenceName, competition: c.competition, season: c.season, source: c.source, lastUpdated: c.lastUpdated },
}));

const TOP = { 5: 82, 4: 77, 3: 72, 2: 67, 1: 62 };
/** Club created by the game for country `code`, slot n (deterministic). */
function gameClub(code, n, division, rank) {
  const ct = countryOf(code), id = `g-${code}-${n}`, h = hash(id);
  const combos = []; for (const city of ct.cities) for (const nick of NICK) combos.push([city, nick]);
  const order = combos.map((c, i) => [hash(code + i) ^ (i * 2654435761), c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const [city, nick] = order[n % order.length];
  const name = `${city} ${nick}`, short = (city.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 2) + nick[0]).toUpperCase();
  const c1 = COLORS[h % COLORS.length]; let c2 = COLORS[(h >>> 5) % COLORS.length]; if (c2 === c1) c2 = 0xffffff;
  const rating = Math.max(40, Math.min(90, TOP[ct.level] - (division - 1) * 5 - Math.round(rank * 0.6) + ((h >>> 4) % 5) - 2));
  return { id, name, short, color: c1, color2: c2, color3: 0xffffff, rating, ...derived(rating, h),
    logo: { shape: SHAPES[h % SHAPES.length], symbol: SYMBOLS[(h >>> 3) % SYMBOLS.length], letters: short.slice(0, 3), pattern: ['none', 'halves', 'stripe', 'ring'][(h >>> 6) % 4], border: (h >>> 8) % 2 ? 'double' : 'single' },
    kits: kitsFor([c1, c2], h), country: code, city, competition: divisionName(code, division), stadium: `Aquatic Centre ${city}`,
    gameCreated: true, verified: false, ref: null };
}

/** Unique 3-letter abbreviation in the country (no digits): letters of the city and of the nickname. */
function uniqueShort(club, used) {
  const C = club.city.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase(), K = club.name.slice(club.city.length).normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
  const cands = [C[0] + C[1] + K[0], C[0] + K[0] + K[1], C[0] + C[1] + C[2], C[0] + C[2] + K[0], C[0] + K[1] + K[2], C[0] + C[1] + K[1], C[0] + C[3] + K[0], K[0] + K[1] + K[2], C[0] + K[0] + K[2], C[0] + C[2] + K[1]];
  for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) cands.push(C[0] + K[i] + K[j]);
  for (let a = 0; a < 26; a++) cands.push(C[0] + K[0] + String.fromCharCode(65 + a));
  const s = cands.find((x) => x && x.length === 3 && !x.includes('undefined') && !used.has(x)); used.add(s); club.short = s; club.logo.letters = s; return club;
}
const COUNTRY_CACHE = new Map(), CLUB_CACHE = new Map(REAL_CLUBS.map((c) => [c.id, c]));
/** The 45 clubs of a country at the start of a career (division 1 = the strongest), + reserve clubs. */
export function countryClubs(code) {
  if (COUNTRY_CACHE.has(code)) return COUNTRY_CACHE.get(code);
  const real = REAL_CLUBS.filter((c) => c.country === code).sort((a, b) => b.rating - a.rating);
  const divisions = Array.from({ length: DIVS }, () => []), used = new Set(real.map((c) => c.short)); let n = 0;
  real.forEach((c, i) => divisions[Math.min(DIVS - 1, Math.floor(i / PER_DIV))].push(c.id));
  for (let d = 0; d < DIVS; d++) while (divisions[d].length < PER_DIV) { const g = uniqueShort(gameClub(code, n++, d + 1, divisions[d].length), used); CLUB_CACHE.set(g.id, g); divisions[d].push(g.id); }
  const out = { divisions, next: n, used };
  COUNTRY_CACHE.set(code, out); return out;
}
/** A reserve game-created club of `division` (replaces the real club the user takes over). */
export function reserveClub(code, division, k) {
  const g = uniqueShort(gameClub(code, 100 + k, division, 4), countryClubs(code).used); g.id = `g-${code}-r${k}`; CLUB_CACHE.set(g.id, g); return g.id;
}
/** Any club of the world by id (real or game-created). */
export function clubById(id) {
  if (CLUB_CACHE.has(id)) return CLUB_CACHE.get(id);
  const m = /^g-([A-Z]{3})-(r?)(\d+)$/.exec(id || ''); if (!m || !countryOf(m[1])) return null;
  if (m[2]) { reserveClub(m[1], 3, +m[3]); return CLUB_CACHE.get(id); }
  countryClubs(m[1]); return CLUB_CACHE.get(id) || null;
}

// ---------------------------------------------------------------- end of season (pure)
/**
 * Moves between divisions from the final rankings (index 0 = division 1).
 *  - promoted from division d ≥ 2: the 1st + the winner of 2nd v 3rd;
 *  - the same number of AI clubs (lowest ranked, never the user's club) go down from division d-1,
 *    so that every division keeps its 9 AI clubs.
 * Returns the new divisions, the user's new division and the lists of promoted / relegated clubs.
 */
export function applyMoves(divisions, rankings, playoffs, userDivision) {
  const next = divisions.map((d) => d.slice()), promoted = {}, relegated = {};
  let userTo = userDivision;
  for (let d = DIVS; d >= 2; d--) {
    const r = rankings[d - 1], up = [r[0], playoffs[d - 1].winner];
    promoted[d] = up; const aiUp = up.filter((id) => id !== 'user');
    if (up.includes('user')) userTo = d - 1;
    const above = rankings[d - 2].filter((id) => id !== 'user'), down = above.slice(above.length - aiUp.length);
    relegated[d - 1] = down;
    next[d - 1] = next[d - 1].filter((id) => !aiUp.includes(id)).concat(down);
    next[d - 2] = next[d - 2].filter((id) => !down.includes(id)).concat(aiUp);
  }
  return { divisions: next, userTo, promoted, relegated };
}
/** Continental places of the D1 clubs: 1st → place 1, winner of 2nd v 3rd → place 2, loser → 3, then 4th… */
export function continentalPlaces(code, ranking, playoff) {
  const slots = countryOf(code).continentalQualificationSlots, loser = playoff.winner === playoff.a ? playoff.b : playoff.a;
  const order = [ranking[0], playoff.winner, loser, ...ranking.slice(3)];
  return slots.map((competition, i) => ({ id: order[i], competition, seed: i + 1 }));
}
