export function selectShinperioHoles(count = 12): number[] {
  const holes = Array.from({ length: 18 }, (_, i) => i + 1)
  for (let i = holes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[holes[i], holes[j]] = [holes[j], holes[i]]
  }
  return holes.slice(0, count).sort((a, b) => a - b)
}
