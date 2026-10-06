// Run: node tools/data/build-clubs.mjs  — builds web/data/clubs.json (+ clubs.js for the game modules).
// REFERENCE DATA (officialReferenceName, city, country, competition, season, source) comes from public
// sources listed per league (consulted 2026-10-06). It is kept separate from the GAME IDENTITY
// (gameClubName, shortName, colours, logo, kits, rating), which is an original creation of WATER POLO 26:
// adapted name (see web/data/adapt.js), generated logo, original kits, game rating (balance, not a real
// ranking). No official logo, crest, kit, sponsor or photo is used. Sponsor names are omitted from the
// reference names. Men's top divisions, season 2025-26.
import fs from 'fs';
import { adaptName, adaptShort } from '../../web/data/adapt.js';

const SRC = {
  FRA: ['https://fr.wikipedia.org/wiki/Championnat_de_France_masculin_de_water-polo_2025-2026', 'https://www.cnmarseille.com/water-polo/water-polo-elite/'],
  ITA: ['https://www.oasport.it/2026/05/pallanuoto-la-pro-recco-passa-a-brescia-e-chiude-la-regular-season-di-serie-a1-a-punteggio-pieno/', 'https://www.oasport.it/2026/03/pallanuoto-il-brescia-vince-e-torna-a-3-dalla-pro-recco-in-serie-a1-successi-per-ortigia-e-de-akker/'],
  ESP: ['https://es.wikipedia.org/wiki/Divisi%C3%B3n_de_Honor_de_waterpolo', 'https://lewaterpolo.com/'],
  HUN: ['https://en.wikipedia.org/wiki/Orsz%C3%A1gos_Bajnoks%C3%A1g_I_(men%27s_water_polo)', 'https://total-waterpolo.com/category/featured/hungarian-water-polo-league/'],
  GRE: ['https://en.wikipedia.org/wiki/A1_Ethniki_Water_Polo', 'https://en.wikipedia.org/wiki/Ethnikos_Piraeus_Water_Polo_Club'],
  CRO: ['https://en.wikipedia.org/wiki/Croatian_First_League_of_Water_Polo', 'https://total-waterpolo.com/category/featured/croatian-water-polo-league/'],
  SRB: ['https://en.wikipedia.org/wiki/Serbian_Water_Polo_Super_League', 'https://total-waterpolo.com/radnicki-downs-novi-beograd-for-3rd-time-to-retain-serbian-title/'],
  GER: ['https://en.wikipedia.org/wiki/Deutsche_Wasserball-Liga', 'https://en.wikipedia.org/wiki/Wasserfreunde_Spandau_04'],
};
// Real competitions (reference) and the adapted name used by the game.
export const LEAGUES = {
  FRA: { official: "Championnat de France Élite (FFN)", game: 'Élite France' },
  ITA: { official: 'Serie A1 (FIN)', game: 'Lega A1 Italia' },
  ESP: { official: 'División de Honor (RFEN)', game: 'Liga de Honor' },
  HUN: { official: 'Országos Bajnokság I (MVLSZ)', game: 'Magyar Liga I' },
  GRE: { official: 'A1 Ethniki', game: 'Hellas A1' },
  CRO: { official: 'Prva hrvatska vaterpolska liga', game: 'Hrvatska Liga' },
  SRB: { official: 'Superliga Srbije', game: 'Srpska Superliga' },
  GER: { official: 'Deutsche Wasserball-Liga', game: 'Wasserball Liga' },
};
// [id, officialReferenceName, city, country, steps, colours [1, 2, 3], game rating]
const C = [
  ['marseille', 'Cercle des Nageurs de Marseille', 'Marseille', 'FRA', [['drop', 'des'], ['drop', 'Nageurs']], [0x1d4fa3, 0xffffff, 0x0b2348], 80],
  ['aix', "Pays d'Aix Natation", 'Aix-en-Provence', 'FRA', [['swap', 'Natation', 'N.']], [0x1f6fb2, 0xf2c81a, 0x0d2c4a], 74],
  ['sete', 'Sète NEDD', 'Sète', 'FRA', [['swap', 'NEDD', 'Nautic']], [0x18a0c8, 0xffffff, 0x0a3550], 73],
  ['montpellier', 'Montpellier Water-Polo', 'Montpellier', 'FRA', [['swap', 'Water-Polo', 'Polo Club']], [0xd2471c, 0x1b3c8c, 0xffffff], 73],
  ['nice', 'Olympic Nice Natation', 'Nice', 'FRA', [['drop', 'Olympic']], [0xc8202f, 0x16181d, 0xffffff], 71],
  ['douai', 'Douaisis Agglo', 'Douai', 'FRA', [['drop', 'Agglo'], ['add', 'WP']], [0x2a7d3a, 0xf2c81a, 0xffffff], 66],
  ['bordeaux', 'USB Bordeaux', 'Bordeaux', 'FRA', [['swap', 'USB', 'US']], [0x6c1d45, 0xffffff, 0x2a0a1c], 67],
  ['strasbourg', 'Strasbourg', 'Strasbourg', 'FRA', [['add', 'Polo']], [0x1e5bd8, 0xd8321e, 0xffffff], 65],
  ['taverny', 'Taverny SN 95', 'Taverny', 'FRA', [['drop', 'SN']], [0x0f7a8a, 0xffffff, 0x063a42], 64],
  ['recco', 'Pro Recco Waterpolo', 'Recco', 'ITA', [['drop', 'Waterpolo'], ['letter', [1, 3], ''], ['letter', [1, 3], 'a']], [0x2a8fd8, 0xffffff, 0x0d2f5a], 86],
  ['brescia', 'AN Brescia', 'Brescia', 'ITA', [['drop', 'AN'], ['add', 'Aquatica']], [0x1c3f94, 0xffffff, 0xd8321e], 82],
  ['savona', 'RN Savona', 'Savona', 'ITA', [['swap', 'RN', 'R.']], [0xd8321e, 0xffffff, 0x1d1d1d], 79],
  ['posillipo', 'CN Posillipo', 'Napoli', 'ITA', [['drop', 'CN'], ['letter', [0, 4], '']], [0xf2c81a, 0x1e3f8a, 0xffffff], 76],
  ['trieste', 'Pallanuoto Trieste', 'Trieste', 'ITA', [['keep', [1]], ['add', 'PN']], [0xc8202f, 0xffffff, 0x2a2a2a], 75],
  ['ortigia', 'CC Ortigia', 'Siracusa', 'ITA', [['drop', 'CC'], ['letter', [0, 3], 'y']], [0x1b6fb8, 0xf2c81a, 0xffffff], 75],
  ['deakker', 'De Akker Team', 'Bologna', 'ITA', [['letter', [1, 2], '']], [0xe0701c, 0x16181d, 0xffffff], 72],
  ['barceloneta', 'CN Atlètic-Barceloneta', 'Barcelona', 'ESP', [['swap', 'Atlètic-Barceloneta', 'Barceloneta'], ['drop', 'CN'], ['add', 'AC']], [0x1b3c8c, 0xd8321e, 0xffffff], 85],
  ['terrassa', 'CN Terrassa', 'Terrassa', 'ESP', [['letter', [1, 5], '']], [0x16181d, 0xffffff, 0xd8321e], 77],
  ['sabadell', 'CN Sabadell', 'Sabadell', 'ESP', [['drop', 'CN'], ['letter', [0, 6], ''], ['add', 'N.']], [0x1e5bd8, 0xffffff, 0x0b2348], 76],
  ['mataro', 'CN Mataró', 'Mataró', 'ESP', [['drop', 'CN'], ['letter', [0, 5], 'o'], ['add', 'Polo']], [0x1f8a70, 0xffffff, 0x0b3a2e], 72],
  ['cnbarcelona', 'CN Barcelona', 'Barcelona', 'ESP', [['swap', 'CN', 'C']], [0x1b3c8c, 0xc8202f, 0xf2c81a], 73],
  ['mediterrani', 'CE Mediterrani', 'Barcelona', 'ESP', [['drop', 'CE'], ['add', 'Barcelona']], [0x13a6c8, 0xffffff, 0x0b3550], 70],
  ['canoe', 'Real Canoe NC', 'Madrid', 'ESP', [['drop', 'Real'], ['drop', 'NC'], ['add', 'Madrid']], [0xffffff, 0x1b3c8c, 0xd8321e], 70],
  ['echeyde', 'SC Tenerife Echeyde', 'Santa Cruz de Tenerife', 'ESP', [['drop', 'SC'], ['keep', [1, 0]]], [0xf2c81a, 0x1b6fb8, 0xffffff], 72],
  ['rubi', 'CN Rubí', 'Rubí', 'ESP', [['drop', 'CN'], ['letter', [0, 3], 'i'], ['add', 'Polo']], [0x7a2fd0, 0xffffff, 0x2a0d4a], 68],
  ['ferencvaros', 'Ferencvárosi TC', 'Budapest', 'HUN', [['drop', 'TC'], ['letter', [0, 11], ''], ['add', 'Budapest']], [0x1f8a3a, 0xffffff, 0x0b3a1a], 85],
  ['vasas', 'Vasas SC', 'Budapest', 'HUN', [['drop', 'SC'], ['add', 'Budapest']], [0x1e3f8a, 0xd8321e, 0xffffff], 78],
  ['bvsc', 'BVSC', 'Budapest', 'HUN', [['swap', 'BVSC', 'BV'], ['add', 'Budapest']], [0xd8321e, 0xffffff, 0x16181d], 76],
  ['szolnok', 'Szolnoki Dózsa', 'Szolnok', 'HUN', [['letter', [0, 7], ''], ['drop', 'Dózsa'], ['add', 'Polo']], [0x1e5bd8, 0xf2c81a, 0xffffff], 76],
  ['eger', 'Egri VK', 'Eger', 'HUN', [['drop', 'VK'], ['swap', 'Egri', 'Eger'], ['add', 'Polo']], [0x1b3c8c, 0xffffff, 0xf2c81a], 75],
  ['olympiacos', 'Olympiacos Piraeus', 'Piraeus', 'GRE', [['swap', 'Olympiacos', 'Olympic']], [0xc8202f, 0xffffff, 0x5a0c14], 84],
  ['vouliagmeni', 'NO Vouliagmeni', 'Vouliagmeni', 'GRE', [['drop', 'NO'], ['add', 'Athens']], [0x0d6fb8, 0xffffff, 0x062c4a], 76],
  ['panathinaikos', 'Panathinaikos', 'Athens', 'GRE', [['swap', 'Panathinaikos', 'Panathinai'], ['add', 'Athens']], [0x1f8a3a, 0xffffff, 0x0b3a1a], 75],
  ['ethnikos', 'Ethnikos Piraeus', 'Piraeus', 'GRE', [['letter', [0, 7], '']], [0x1b6fb8, 0xffffff, 0x0b2348], 73],
  ['jadran', 'VK Jadran Split', 'Split', 'CRO', [['drop', 'VK'], ['letter', [0, 5], ''], ['keep', [1, 0]]], [0xffffff, 0x1b3c8c, 0xd8321e], 82],
  ['mladost', 'HAVK Mladost', 'Zagreb', 'CRO', [['drop', 'HAVK'], ['add', 'Zgb']], [0x1e5bd8, 0xffffff, 0x0b2348], 79],
  ['jug', 'VK Jug Dubrovnik', 'Dubrovnik', 'CRO', [['drop', 'VK'], ['swap', 'Jug', 'J']], [0xd8321e, 0xffffff, 0x16181d], 78],
  ['primorje', 'PVK Primorje', 'Rijeka', 'CRO', [['drop', 'PVK'], ['add', 'Rijeka']], [0x1b6fb8, 0xffffff, 0xf2c81a], 73],
  ['novibeograd', 'VK Novi Beograd', 'Belgrade', 'SRB', [['drop', 'VK'], ['swap', 'Novi', 'N.']], [0x16181d, 0xf2c81a, 0xffffff], 83],
  ['radnicki', 'VK Radnički Kragujevac', 'Kragujevac', 'SRB', [['drop', 'VK'], ['letter', [0, 5], 'c'], ['swap', 'Kragujevac', 'K.']], [0xd8321e, 0x1b3c8c, 0xffffff], 81],
  ['hannover', 'Waspo 98 Hannover', 'Hannover', 'GER', [['drop', '98'], ['swap', 'Waspo', 'Wasp']], [0x1e5bd8, 0xd8321e, 0xffffff], 78],
  ['spandau', 'Wasserfreunde Spandau 04', 'Berlin', 'GER', [['drop', 'Wasserfreunde'], ['drop', '04'], ['add', 'WF', 'start']], [0x1b3c8c, 0xffffff, 0xf2c81a], 76],
];
const SHAPES = ['shield', 'circle', 'hex', 'roundel', 'diamond', 'pennant'], SYMBOLS = ['wave', 'ball', 'trident', 'fin', 'star', 'goal', 'drop', 'letters'];
const PATTERNS = ['plain', 'halves', 'stripe', 'sash', 'plain', 'chevron'];
const hash = (s) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
const SHORT = { barceloneta: 'BAC', cnbarcelona: 'CBA', ferencvaros: 'FEB', bvsc: 'BVU', sete: 'SET' };
const clubs = C.map(([id, official, city, country, steps, colors, rating]) => {
  const gameClubName = adaptName(official, steps), h = hash(id);
  if (gameClubName === official) throw new Error('name not adapted: ' + official);
  const shortName = SHORT[id] || adaptShort(gameClubName, official);
  return {
    id, baseClubId: id,
    // --- reference data (public sources) ---
    officialReferenceName: official, city, country, competition: LEAGUES[country].official, gender: 'men', season: '2025-26',
    source: SRC[country], lastUpdated: '2026-10-06',
    // --- game identity (original WATER POLO 26) ---
    gameClubName, shortName, adaptation: steps, gameCompetition: LEAGUES[country].game,
    colors: colors, rating,
    logo: { shape: SHAPES[h % SHAPES.length], symbol: SYMBOLS[(h >> 3) % SYMBOLS.length], letters: shortName, pattern: ['none', 'halves', 'stripe', 'ring'][(h >> 6) % 4], border: (h >> 8) % 2 ? 'double' : 'single' },
    kits: {
      home: { suit: colors[0], suit2: colors[1], pattern: PATTERNS[(h >> 9) % PATTERNS.length], cap: colors[0], capTrim: colors[1], number: colors[1] },
      away: { suit: colors[1], suit2: colors[0], pattern: PATTERNS[(h >> 12) % PATTERNS.length], cap: 0xf4f6f8, capTrim: colors[0], number: colors[0] },
      goalkeeper: { cap: 0xd81a1f, capTrim: 0xffffff, number: 0xffffff },
    },
  };
});
const shorts = clubs.map((c) => c.shortName); if (new Set(shorts).size !== shorts.length) throw new Error('duplicate short names');
const out = { note: 'Reference data from public sources (field "source"); game identity (gameClubName, logo, kits, rating) is an original WATER POLO 26 creation. No official logos, kits or sponsors.', leagues: LEAGUES, clubs };
fs.writeFileSync('web/data/clubs.json', JSON.stringify(out, null, 1) + '\n');
fs.writeFileSync('web/data/clubs.js', '// GENERATED by tools/data/build-clubs.mjs from the same data as clubs.json — do not edit.\nexport default ' + JSON.stringify(out) + ';\n');
for (const c of clubs) console.log(c.country, c.officialReferenceName.padEnd(28), '->', c.gameClubName.padEnd(24), c.shortName);
