export type Rng = () => number

export function createRng(seed: number): Rng {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  const n = Math.floor(rng() * (maxInclusive - minInclusive + 1)) + minInclusive
  return Math.min(maxInclusive, Math.max(minInclusive, n))
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)]!
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p
}
