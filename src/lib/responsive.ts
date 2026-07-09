export const COMPACT_SCREEN_WIDTH = 390;

export function isCompactWidth(width: number) {
  return width < COMPACT_SCREEN_WIDTH;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}
