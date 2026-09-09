/**
 * Dark-first palette. The base is near-black and each workout phase supplies an
 * accent used for the ring, the active row and the primary control — the phase
 * colour is never used as the page background, or nothing would contrast
 * against it.
 *
 * Phase hues are spread deliberately: mid-effort the colour is read from the
 * corner of the eye, so work and rest have to be unmistakable at a glance
 * rather than merely different.
 */
export const theme = {
  base: '#0E0E10',
  surface: 'rgba(255,255,255,0.05)',
  surfaceStrong: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.10)',
  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.62)',
  textFaint: 'rgba(255,255,255,0.38)',
  /** Electric violet — the app's identity colour, and the work phase. */
  brand: '#7C5CFF',
  /** Deeper end of the brand gradient. */
  brandDeep: '#5A3BE0',
  /** Brand at low opacity, for wash fills behind brand-coloured glyphs. */
  brandWash: 'rgba(124,92,255,0.16)',
  danger: '#F43F5E',
  success: '#22C55E',
} as const;

export const phaseColors = {
  prepare: '#FBBF24', // amber   — hold still, something is coming
  work: '#7C5CFF', // violet  — the one phase that has to shout
  rest: '#22C55E', // green   — recover; furthest hue from work
  setRest: '#38BDF8', // sky     — a longer, calmer recovery
} as const;

export const pausedColor = '#9CA3AF';

/** Blend `color` toward the base by `amount` (0 = base, 1 = color). */
export function tint(color: string, amount: number): string {
  const { r, g, b } = parseHex(color);
  const br = 0x0e;
  const bg = 0x0e;
  const bb = 0x10;
  const mix = (c: number, base: number) => Math.round(base + (c - base) * amount);
  return `rgb(${mix(r, br)}, ${mix(g, bg)}, ${mix(b, bb)})`;
}

/**
 * Readable ink for text and glyphs sitting *on top of* an accent fill.
 *
 * Picking this by hand does not survive a palette change — white on the old
 * orange was only 2.9:1 — so it is computed from relative luminance and the
 * accent is free to move.
 */
export function onAccent(color: string): string {
  const { r, g, b } = parseHex(color);
  const luminance =
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  // Contrast against black is (L + 0.05) / 0.05; against white it is
  // 1.05 / (L + 0.05). Take whichever is higher.
  return (luminance + 0.05) ** 2 >= 0.05 * 1.05 ? '#000000' : '#FFFFFF';
}

function parseHex(color: string): { r: number; g: number; b: number } {
  const hex = color.replace('#', '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/** sRGB channel (0-255) to its linear-light value, per WCAG. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
