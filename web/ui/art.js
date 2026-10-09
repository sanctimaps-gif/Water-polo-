// Original vector art for the UI: club logos generated from components (shape + symbol + colours)
// and a small consistent icon set. No third-party or proprietary artwork.
const hex = (c) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c);

const SHAPES = {
  shield: 'M50 4 L92 16 L88 58 Q82 84 50 98 Q18 84 12 58 L8 16 Z',
  circle: 'M50 4 A46 46 0 1 1 49.9 4 Z',
  hex: 'M50 3 L92 27 L92 73 L50 97 L8 73 L8 27 Z',
  roundel: 'M50 6 A44 44 0 1 1 49.9 6 Z',
  diamond: 'M50 3 L95 50 L50 97 L5 50 Z',
  pennant: 'M10 6 H90 V62 L50 96 L10 62 Z',
};
const SYMBOLS = {
  wave: '<path d="M18 58 Q30 44 42 58 T66 58 T86 52" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M22 72 Q34 60 46 72 T70 72" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" opacity=".7"/><circle cx="62" cy="34" r="11" fill="currentColor"/>',
  ball: '<circle cx="50" cy="52" r="24" fill="none" stroke="currentColor" stroke-width="7"/><path d="M28 44 Q50 56 72 44 M34 70 Q50 48 66 70 M50 28 Q42 52 50 76" fill="none" stroke="currentColor" stroke-width="5"/>',
  trident: '<path d="M50 22 V80 M32 30 V46 Q32 56 50 56 Q68 56 68 46 V30" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M50 14 L44 26 H56 Z M32 22 L27 33 H37 Z M68 22 L63 33 H73 Z" fill="currentColor"/>',
  fin: '<path d="M22 70 Q48 64 60 22 Q66 52 82 70 Z" fill="currentColor"/><path d="M16 78 Q34 70 50 78 T84 78" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
  star: '<path d="M50 20 L58 42 L82 42 L63 56 L70 79 L50 65 L30 79 L37 56 L18 42 L42 42 Z" fill="currentColor"/>',
  goal: '<path d="M22 70 V36 H78 V70" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M28 42 H72 M28 52 H72 M28 62 H72 M38 36 V70 M50 36 V70 M62 36 V70" stroke="currentColor" stroke-width="2.5" opacity=".7"/><circle cx="68" cy="28" r="9" fill="currentColor"/>',
  drop: '<path d="M50 18 Q72 46 72 60 A22 22 0 0 1 28 60 Q28 46 50 18 Z" fill="currentColor"/><path d="M40 62 A10 10 0 0 0 50 72" fill="none" stroke="#fff" stroke-width="4" opacity=".5"/>',
  crown: '<path d="M22 70 L26 34 L40 50 L50 26 L60 50 L74 34 L78 70 Z" fill="currentColor"/><rect x="22" y="72" width="56" height="8" rx="3" fill="currentColor"/>',
};
export const LOGO_SHAPES = Object.keys(SHAPES);
export const LOGO_SYMBOLS = ['wave', 'ball', 'trident', 'fin', 'star', 'goal', 'drop', 'letters'];
export const LOGO_PATTERNS = ['none', 'halves', 'stripe', 'ring'];
const escT = (t) => String(t || '').replace(/[^A-Za-z0-9À-ÿ]/g, '').slice(0, 4).toUpperCase();

/** Original club logo: shape + pattern + symbol (or letters) + border, in up to 3 colours. */
export function logoSvg(logo, color, color2, size = 48, color3) {
  const shapeKey = SHAPES[logo.shape] ? logo.shape : 'shield', shape = SHAPES[shapeKey], c1 = hex(color), c2 = hex(color2), c3 = hex(color3 ?? color2);
  const id = `lg${size}${shapeKey}${(logo.pattern || 'n')[0]}${Math.random().toString(36).slice(2, 7)}`;
  const pat = logo.pattern === 'halves' ? `<rect x="50" y="0" width="50" height="100" fill="${c3}" opacity=".9"/>`
    : logo.pattern === 'stripe' ? `<rect x="40" y="0" width="20" height="100" fill="${c3}" opacity=".9"/>`
    : logo.pattern === 'ring' ? `<circle cx="50" cy="52" r="30" fill="none" stroke="${c3}" stroke-width="6" opacity=".9"/>` : '';
  const letters = escT(logo.letters);
  const sym = logo.symbol === 'letters'
    ? `<text x="50" y="${letters.length > 3 ? 62 : 64}" text-anchor="middle" font-family="'Barlow Condensed', Arial, sans-serif" font-weight="800" font-size="${letters.length > 3 ? 26 : letters.length === 3 ? 32 : 40}" fill="currentColor" stroke="#0006" stroke-width="1">${letters}</text>`
    : (SYMBOLS[logo.symbol] || SYMBOLS.wave);
  const border = logo.border === 'double' ? `<path d="${shape}" fill="none" stroke="${c2}" stroke-width="3" transform="translate(50 50) scale(.86) translate(-50 -50)"/>` : '';
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
    <clipPath id="${id}c"><path d="${shape}"/></clipPath></defs>
    <path d="${shape}" fill="${c1}"/>
    <g clip-path="url(#${id}c)">${pat}</g>
    <path d="${shape}" fill="url(#${id})" stroke="${c2}" stroke-width="5"/>${border}
    <g style="color:${c2}">${sym}</g></svg>`;
}

const I = {
  gear: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.6 4.9-1.9-.4a6.9 6.9 0 0 1-.7 1.7l1.1 1.6-1.6 1.6-1.6-1.1a6.9 6.9 0 0 1-1.7.7l-.4 1.9h-2.4l-.4-1.9a6.9 6.9 0 0 1-1.7-.7l-1.6 1.1-1.6-1.6 1.1-1.6a6.9 6.9 0 0 1-.7-1.7l-1.9-.4v-2.4l1.9-.4c.2-.6.4-1.2.7-1.7L5.6 6.4 7.2 4.8l1.6 1.1c.5-.3 1.1-.5 1.7-.7l.4-1.9h2.4l.4 1.9c.6.2 1.2.4 1.7.7l1.6-1.1 1.6 1.6-1.1 1.6c.3.5.5 1.1.7 1.7l1.9.4Z" fill="currentColor"/>',
  trophy: '<path d="M7 3h10v3h3v2a5 5 0 0 1-4.3 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 13 5 5 0 0 1 4 8V6h3Zm0 5V8H6a3 3 0 0 0 1 2.2Zm10 0v2.2A3 3 0 0 0 18 8Z" fill="currentColor"/>',
  chart: '<path d="M4 20V10h4v10Zm6 0V4h4v16Zm6 0v-7h4v7Z" fill="currentColor"/>',
  cap: '<path d="M4 15a8 8 0 0 1 16 0v1H4Z" fill="currentColor"/><circle cx="5.5" cy="16.5" r="2.5" fill="currentColor"/><circle cx="18.5" cy="16.5" r="2.5" fill="currentColor"/>',
  list: '<path d="M4 6h2v2H4Zm4 0h12v2H8ZM4 11h2v2H4Zm4 0h12v2H8Zm-4 5h2v2H4Zm4 0h12v2H8Z" fill="currentColor"/>',
  gift: '<path d="M3 9h18v4H3Zm2 5h6v7H5Zm8 0h6v7h-6ZM11 9h2v12h-2Zm1-1C9 8 7 7 7 5.5S9 3 12 8c3-5 5-4 5-2.5S15 8 12 8Z" fill="currentColor"/>',
  team: '<circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="16" cy="8" r="3" fill="currentColor"/><path d="M2 19a6 6 0 0 1 12 0Zm8 0a6 6 0 0 1 12 0Z" fill="currentColor"/>',
  calendar: '<path d="M4 6h16v14H4Zm2 4v8h12v-8ZM7 3h2v4H7Zm8 0h2v4h-2Z" fill="currentColor"/>',
  pool: '<path d="M2 13q5-6 10-6t10 6v5H2Z" fill="currentColor" opacity=".35"/><path d="M2 13q5-6 10-6t10 6M5 15h14M7 18h10" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M4 11V8m4 1V6m8 3V6m4 5V8" stroke="currentColor" stroke-width="1.4"/>',
  bag: '<path d="M5 8h14l-1 13H6Zm3 0a4 4 0 0 1 8 0h-2a2 2 0 0 0-4 0Z" fill="currentColor"/>',
  coin: '<circle cx="12" cy="12" r="9" fill="#f5c21b" stroke="#a87700" stroke-width="2"/><path d="M12 7v10M9.5 9.5h4a1.7 1.7 0 0 1 0 3.4h-3a1.7 1.7 0 0 0 0 3.4h4" fill="none" stroke="#7a5300" stroke-width="1.8"/>',
  gem: '<path d="M6 4h12l4 5-10 12L2 9Z" fill="#33d6ff" stroke="#0a8fb8" stroke-width="1.5"/><path d="M2 9h20M8 4l4 17 4-17" fill="none" stroke="#0a8fb8" stroke-width="1"/>',
  plus: '<path d="M11 5h2v14h-2zM5 11h14v2H5z" fill="currentColor"/>',
  play: '<path d="M8 5l12 7-12 7Z" fill="currentColor"/>',
  lock: '<path d="M7 10V7a5 5 0 0 1 10 0v3h1v11H6V10Zm2 0h6V7a3 3 0 0 0-6 0Z" fill="currentColor"/>',
  star: '<path d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9Z" fill="currentColor"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  pause: '<path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor"/>',
  dumbbell: '<path d="M2 10h2V8h2v8H4v-2H2Zm4-3h2v10H6Zm10 0h2v10h-2Zm2 1h2v2h2v4h-2v2h-2ZM8 11h8v2H8Z" fill="#35d0ff"/>',
  medkit: '<path d="M8 4h8v3h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4Zm2 2v1h4V6Zm1 4v3H8v2h3v3h2v-3h3v-2h-3v-3Z" fill="#ff4fd8"/>',
  bolt: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11Z" fill="#ff4d6d"/><path d="M13 7l-4 6h3l-1 5 4-7h-3Z" fill="#fff"/>',
  token0: '<path d="M4 4h16v13l-8 4-8-4Z" fill="#c9824a"/><path d="M8 9l4-3 4 3M8 13l4-3 4 3" stroke="#fff" stroke-width="1.6" fill="none"/>',
  token1: '<path d="M4 4h16v13l-8 4-8-4Z" fill="#aeb8c6"/><path d="M8 9l4-3 4 3M8 13l4-3 4 3" stroke="#fff" stroke-width="1.6" fill="none"/>',
  token2: '<path d="M4 4h16v13l-8 4-8-4Z" fill="#e8b928"/><path d="M8 9l4-3 4 3M8 13l4-3 4 3" stroke="#fff" stroke-width="1.6" fill="none"/>',
  token3: '<path d="M4 4h16v13l-8 4-8-4Z" fill="#b13cff"/><path d="M8 9l4-3 4 3M8 13l4-3 4 3" stroke="#fff" stroke-width="1.6" fill="none"/>',
  swap: '<path d="M4 8h12l-3-3 1.4-1.4L20 9l-5.6 5.4L13 13l3-3H4Zm16 8H8l3 3-1.4 1.4L4 15l5.6-5.4L11 11l-3 3h12Z" fill="currentColor"/>',
  up: '<path d="M12 4l7 8h-4v8H9v-8H5Z" fill="currentColor"/>',
};
export const icon = (name, size = 22) => `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${I[name] || ''}</svg>`;

/** Original trophy illustration, tinted per event tier. */
export function trophySvg(c1, c2, size = 84) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="tr${c1.slice(1)}" x1="0" x2="1"><stop offset="0" stop-color="${c2}"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>
    <path d="M30 14h40v18a20 20 0 0 1-40 0Z" fill="url(#tr${c1.slice(1)})"/>
    <path d="M30 20H18v6a14 14 0 0 0 14 14M70 20h12v6a14 14 0 0 1-14 14" fill="none" stroke="${c1}" stroke-width="5"/>
    <path d="M45 52h10v16H45Z" fill="${c1}"/><path d="M32 70h36v8H32Zm-6 8h48v8H26Z" fill="${c2}"/>
    <circle cx="50" cy="30" r="7" fill="${c1}" opacity=".7"/></svg>`;
}

/** Simple national flags (plain colour stripes, drawn in SVG so they look the same on every phone). */
const FLAGS = {
  FRA: ['v', '#0055a4', '#ffffff', '#ef4135'], ITA: ['v', '#009246', '#ffffff', '#ce2b37'], ESP: ['h3', '#aa151b', '#f1bf00', '#aa151b'],
  HUN: ['h', '#ce2939', '#ffffff', '#477050'], SRB: ['h', '#c6363c', '#0c4076', '#ffffff'], CRO: ['h', '#ff0000', '#ffffff', '#171796'],
  GER: ['h', '#000000', '#dd0000', '#ffce00'], GRE: ['gr'],
};
export function flagSvg(code, w = 60) {
  const f = FLAGS[code], h = Math.round(w * 2 / 3);
  let body = '<rect width="60" height="40" fill="#556"/>';
  if (f && f[0] === 'v') body = `<rect width="20" height="40" fill="${f[1]}"/><rect x="20" width="20" height="40" fill="${f[2]}"/><rect x="40" width="20" height="40" fill="${f[3]}"/>`;
  else if (f && f[0] === 'h') body = `<rect width="60" height="14" fill="${f[1]}"/><rect y="13" width="60" height="14" fill="${f[2]}"/><rect y="26" width="60" height="14" fill="${f[3]}"/>`;
  else if (f && f[0] === 'h3') body = `<rect width="60" height="40" fill="${f[1]}"/><rect y="10" width="60" height="20" fill="${f[2]}"/>`;
  else if (f && f[0] === 'gr') body = `<rect width="60" height="40" fill="#0d5eaf"/>${[1, 3, 5, 7].map((i) => `<rect y="${i * 4.44}" width="60" height="4.44" fill="#fff"/>`).join('')}<rect width="22" height="22.2" fill="#0d5eaf"/><rect x="8.8" width="4.4" height="22.2" fill="#fff"/><rect y="8.9" width="22" height="4.4" fill="#fff"/>`;
  return `<svg class="flag" width="${w}" height="${h}" viewBox="0 0 60 40" preserveAspectRatio="none" aria-hidden="true">${body}<rect width="60" height="40" fill="none" stroke="#0003"/></svg>`;
}

/** White trophy silhouettes (original drawings), one shape per competition family. */
const TROPHIES = {
  bigear: '<path d="M38 14h24v6c0 14-4 24-12 28-8-4-12-14-12-28Z"/><path d="M38 18c-14-4-20 4-16 12 3 6 10 8 16 8M62 18c14-4 20 4 16 12-3 6-10 8-16 8" fill="none" stroke="#fff" stroke-width="5"/><path d="M46 48h8v14h-8ZM38 62h24v6H38Zm-4 6h32v8H34Z"/>',
  tower: '<path d="M36 12h28l-4 8H40Z"/><path d="M40 22h20v34H40Z" fill="none" stroke="#fff" stroke-width="4"/><path d="M40 30l20 8M60 30l-20 8M40 42l20 8M60 42l-20 8" stroke="#fff" stroke-width="2.5"/><path d="M38 58h24v8H38Zm-4 8h32v10H34Z"/>',
  globe: '<circle cx="50" cy="26" r="14"/><path d="M44 40h12l-2 22h-8Z"/><path d="M40 62h20v6H40Zm-6 6h32v8H34Z"/><path d="M38 22q12 8 24 0M38 30q12-6 24 0" stroke="#0004" stroke-width="2" fill="none"/>',
  goblet: '<path d="M32 12h36c0 18-6 30-18 32-12-2-18-14-18-32Z"/><path d="M47 44h6v16h-6Z"/><path d="M36 60h28l4 8H32Zm-4 8h36v8H32Z"/>',
  plate: '<circle cx="50" cy="36" r="24" fill="none" stroke="#fff" stroke-width="7"/><circle cx="50" cy="36" r="11"/><path d="M40 64h20v5H40Zm-6 5h32v7H34Z"/>',
  wave: '<path d="M34 14h32l-6 26H40Z"/><path d="M28 40q11-8 22 0t22 0v6q-11 8-22 0t-22 0Z"/><path d="M46 48h8v12h-8ZM36 60h28v6H36Zm-4 6h36v10H32Z"/>',
};
export function trophyArt(kind, size = 64) {
  return `<svg class="trophy-art" width="${size}" height="${size}" viewBox="0 0 100 84" fill="#fff" aria-hidden="true">${TROPHIES[kind] || TROPHIES.goblet}</svg>`;
}

/** DÉFIS pictograms: top view of the situation (original line drawings). */
export function drillArt(kind, w = 150) {
  const goal = '<path d="M140 38v24" stroke="#fff" stroke-width="5"/><path d="M140 38h6v24h-6" fill="none" stroke="#fff" stroke-width="2"/>';
  const dot = (x, y, c = '#fff', r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#0006" stroke-width="1.5"/>`;
  const ball = (x, y) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#ffd21a" stroke="#0007"/>`;
  const line = (x, dash = '4 4') => `<path d="M${x} 6v88" stroke="#fff8" stroke-width="2" stroke-dasharray="${dash}"/>`;
  const arrow = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#ffd21a" stroke-width="2.5" stroke-dasharray="5 4" marker-end="url(#ah)"/>`;
  const S = {
    penalty: `${line(100)}${goal}${dot(136, 50, '#e5402e')}${dot(100, 50)}${ball(106, 49)}${arrow(110, 49, 136, 42)}<text x="94" y="92" fill="#fff" font-size="11" font-weight="800">5 m</text>`,
    freethrow: `${line(100)}${line(80, '2 5')}${goal}${dot(136, 50, '#e5402e')}${dot(70, 34)}${ball(76, 34)}${dot(86, 38, '#1b2f5a')}<path d="M86 38l4-9" stroke="#fff" stroke-width="3"/>${arrow(80, 30, 136, 56)}`,
    powerplay: `${line(100)}${goal}${dot(136, 50, '#e5402e')}${[[128, 36], [128, 64], [108, 24], [104, 42], [104, 58], [108, 76]].map(([x, y]) => dot(x, y)).join('')}
      ${[[122, 44], [122, 58], [114, 32], [114, 68], [110, 50]].map(([x, y]) => dot(x, y, '#1b2f5a')).join('')}${ball(98, 42)}<text x="20" y="56" fill="#fff" font-size="22" font-weight="900">6 c 5</text>`,
    tutorial: `${[30, 55, 80, 105].map((x, i) => `<path d="M${x - 6} ${70 - i * 12}h12l-6-14Z" fill="#ffd21a"/>`).join('')}${dot(14, 82)}${ball(20, 82)}${arrow(22, 76, 120, 26)}${goal}`,
  };
  return `<svg class="drill-art" width="${w}" height="${Math.round(w * 0.66)}" viewBox="0 0 150 100" aria-hidden="true"><defs><marker id="ah" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#ffd21a"/></marker></defs>
    <rect x="2" y="4" width="146" height="92" rx="6" fill="#0003" stroke="#fff5"/>${S[kind] || ''}</svg>`;
}

/** Reward pack (original drawing): crimped foil of the tier colour, pool-water body, items, diagonal banner. */
const PACK_FOIL = [['#5a2c10', '#d58a4c', '#8a4b23'], ['#4d5664', '#eef2f7', '#8d99a8'], ['#6b4a00', '#ffe07a', '#b8860b'], ['#2a0a5a', '#d79bff', '#6d28c9']];
export function packArt(tier, label, sub, w = 150) {
  const [d, l, m] = PACK_FOIL[tier] || PACK_FOIL[0], id = 'pk' + tier;
  const crimp = (y, dir) => Array.from({ length: 21 }, (_, i) => `${i * 5},${y + (i % 2 ? dir * 3 : 0)}`).join(' ');
  return `<svg class="pack-art" width="${w}" height="${Math.round(w * 1.5)}" viewBox="0 0 100 150" aria-hidden="true">
    <defs><linearGradient id="${id}f" x1="0" x2="1"><stop offset="0" stop-color="${d}"/><stop offset=".45" stop-color="${l}"/><stop offset=".55" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0fb3d6"/><stop offset=".55" stop-color="#0a5f9e"/><stop offset="1" stop-color="#062a55"/></linearGradient>
      <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <g class="pk-top"><polygon points="0,0 100,0 ${crimp(12, 1).split(' ').reverse().join(' ')}" fill="url(#${id}f)"/>${[3, 6, 9].map((y) => `<path d="M0 ${y}H100" stroke="${d}" stroke-width=".6" opacity=".6"/>`).join('')}</g>
    <polygon points="${crimp(12, 1)} 100,138 ${crimp(138, -1).split(' ').reverse().join(' ')}" fill="url(#${id}b)"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${-30 + i * 24} 150L${30 + i * 24} 12" stroke="#ffffff" stroke-width="5" opacity=".07"/>`).join('')}
    <path d="M6 44q11-6 22 0t22 0t22 0t22 0" stroke="#7fe8ff" stroke-width="1.6" fill="none" opacity=".5"/>
    <text x="8" y="27" fill="#fff" font-size="9.5" font-weight="900" font-style="italic" font-family="system-ui,sans-serif">WATER POLO</text><text x="70" y="28" fill="#ffd21a" font-size="13" font-weight="900" font-style="italic" font-family="system-ui,sans-serif">26</text>
    <circle cx="36" cy="66" r="15" fill="#ffd21a" stroke="#0005"/><path d="M22 61q14 8 28 0M25 76q11-14 22 0M36 51q-6 15 0 30" stroke="#1a3a8a" stroke-width="2.4" fill="none"/>
    <g transform="translate(58 52)"><rect width="26" height="20" rx="3" fill="#fff"/><path d="M10 5h6v4h4v6h-4v4h-6v-4H6V9h4Z" fill="#e5402e" transform="translate(0 -2)"/></g>
    ${[0, 1, 2].map((i) => `<ellipse cx="${28 + i * 9}" cy="${92 - i * 3}" rx="8" ry="3.4" fill="#f2c81a" stroke="#8a6a00" stroke-width=".8"/>`).join('')}
    <rect x="62" y="80" width="18" height="12" rx="2" fill="#2fbf71" stroke="#0a5a30"/><text x="71" y="89" text-anchor="middle" fill="#fff" font-size="7" font-weight="900">+</text>
    <g transform="rotate(-24 50 112)"><rect x="-10" y="100" width="120" height="25" fill="url(#${id}f)" stroke="${d}" stroke-width="1"/>
      <text x="50" y="114" text-anchor="middle" fill="${tier === 1 ? '#1b2330' : '#fff'}" font-size="13" font-weight="900" font-style="italic" font-family="system-ui,sans-serif" stroke="#0004" stroke-width=".4">${label}</text>
      <text x="50" y="122" text-anchor="middle" fill="${tier === 1 ? '#1b2330' : '#fff'}" font-size="5.5" font-weight="800" font-family="system-ui,sans-serif" letter-spacing=".8">${sub}</text></g>
    <polygon points="${crimp(138, -1)} 100,150 0,150" fill="url(#${id}f)"/>
    <rect class="pk-shine" x="-60" y="0" width="40" height="150" fill="url(#${id}s)" transform="skewX(-14)"/></svg>`;
}
