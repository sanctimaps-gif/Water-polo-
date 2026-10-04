// Original vector art for the UI: club logos generated from components (shape + symbol + colours)
// and a small consistent icon set. No third-party or proprietary artwork.
const hex = (c) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c);

const SHAPES = {
  shield: 'M50 4 L92 16 L88 58 Q82 84 50 98 Q18 84 12 58 L8 16 Z',
  circle: 'M50 4 A46 46 0 1 1 49.9 4 Z',
  hex: 'M50 3 L92 27 L92 73 L50 97 L8 73 L8 27 Z',
};
const SYMBOLS = {
  wave: '<path d="M18 58 Q30 44 42 58 T66 58 T86 52" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M22 72 Q34 60 46 72 T70 72" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" opacity=".7"/><circle cx="62" cy="34" r="11" fill="currentColor"/>',
  ball: '<circle cx="50" cy="52" r="24" fill="none" stroke="currentColor" stroke-width="7"/><path d="M28 44 Q50 56 72 44 M34 70 Q50 48 66 70 M50 28 Q42 52 50 76" fill="none" stroke="currentColor" stroke-width="5"/>',
  trident: '<path d="M50 22 V80 M32 30 V46 Q32 56 50 56 Q68 56 68 46 V30" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M50 14 L44 26 H56 Z M32 22 L27 33 H37 Z M68 22 L63 33 H73 Z" fill="currentColor"/>',
  fin: '<path d="M22 70 Q48 64 60 22 Q66 52 82 70 Z" fill="currentColor"/><path d="M16 78 Q34 70 50 78 T84 78" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
  star: '<path d="M50 20 L58 42 L82 42 L63 56 L70 79 L50 65 L30 79 L37 56 L18 42 L42 42 Z" fill="currentColor"/>',
  crown: '<path d="M22 70 L26 34 L40 50 L50 26 L60 50 L74 34 L78 70 Z" fill="currentColor"/><rect x="22" y="72" width="56" height="8" rx="3" fill="currentColor"/>',
};
export const LOGO_SHAPES = Object.keys(SHAPES);
export const LOGO_SYMBOLS = ['wave', 'ball', 'trident', 'fin', 'star'];

export function logoSvg(logo, color, color2, size = 48) {
  const shape = SHAPES[logo.shape] || SHAPES.shield, sym = SYMBOLS[logo.symbol] || SYMBOLS.wave;
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="lg${size}${logo.shape}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
    <path d="${shape}" fill="${hex(color)}" stroke="${hex(color2)}" stroke-width="5"/>
    <path d="${shape}" fill="url(#lg${size}${logo.shape})"/>
    <g style="color:${hex(color2)}">${sym}</g></svg>`;
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
