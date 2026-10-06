// WATER POLO 26 MOBILE — club identity adaptation.
// A real club (reference data) becomes a club of the game with a slightly modified name: recognisable,
// but never the full official identity. Several transformations, chosen per club (not all the same):
//   drop     remove a word (e.g. a club-type prefix: CN, VK, AN, RN, SC...)
//   keep     keep only some words (shorten)
//   letter   change / remove one letter
//   cut      remove part of the name
//   swap     replace a word by a very close variant
//   add      add a neutral word (Polo, Aqua...) when the rest would be too close
// The logos and kits of the game are original creations (see art.js / kits), never the official ones.

/** Applies a list of steps [op, arg, arg2] to an official name. */
export function adaptName(official, steps) {
  let words = official.split(/\s+/);
  for (const [op, a, b] of steps) {
    if (op === 'drop') words = words.filter((w, i) => (typeof a === 'number' ? i !== a : w !== a));
    else if (op === 'keep') words = a.map((i) => words[i]).filter(Boolean);
    else if (op === 'letter') { const w = words[a[0]]; words[a[0]] = w.slice(0, a[1]) + (b || '') + w.slice(a[1] + 1); }
    else if (op === 'cut') words = words.join(' ').replace(a, '').trim().split(/\s+/);
    else if (op === 'swap') words = words.map((w) => (w === a ? b : w));
    else if (op === 'add') words = b === 'start' ? [a, ...words] : [...words, a];
  }
  return words.join(' ').replace(/\s+/g, ' ').trim();
}

/** Short name (3 letters) from the game name: initials or first letters, never the official abbreviation. */
export function adaptShort(gameName, official) {
  const w = gameName.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').split(/\s+/).filter((x) => x.length > 1 || /\d/.test(x));
  const base = (w.length >= 3 ? w.slice(0, 3).map((x) => x[0]).join('') : (w.find((x) => x.length > 3) || w[0] || 'WPC').slice(0, 3)).toUpperCase();
  const off = official.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean).map((x) => x[0]).join('').toUpperCase();
  return base === off ? base.slice(0, 2) + 'X' : base;
}
