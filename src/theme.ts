/**
 * Dark-first palette. The base is near-black and each workout phase supplies an
 * accent used for the ring, the active row and the primary control — the phase
 * colour is never used as the page background, or nothing would contrast
 * against it.
 */
export const theme = {
  base: '#0E0E10',
  surface: 'rgba(255,255,255,0.05)',
  surfaceStrong: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.10)',
  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.62)',
  textFaint: 'rgba(255,255,255,0.38)',
  brand: '#FF6806',
  danger: '#F43F5E',
} as const;

export const phaseColors = {
  prepare: '#FBBF24',
  work: '#FF6806',
  rest: '#22C55E',
  setRest: '#3B82F6',
} as const;

export const pausedColor = '#9CA3AF';

/** Blend `color` toward the base by `amount` (0 = base, 1 = color). */
export function tint(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const br = 0x0e;
  const bg = 0x0e;
  const bb = 0x10;
  const mix = (c: number, base: number) => Math.round(base + (c - base) * amount);
  return `rgb(${mix(r, br)}, ${mix(g, bg)}, ${mix(b, bb)})`;
}
