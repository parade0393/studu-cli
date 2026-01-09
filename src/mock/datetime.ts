import { randInt, type Rng } from './rng'

export function toIso(d: Date): string {
  return d.toISOString()
}

export function randomPastIso(rng: Rng, daysBack: number): string {
  const now = Date.now()
  const delta = randInt(rng, 0, daysBack * 24 * 60 * 60 * 1000)
  return toIso(new Date(now - delta))
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

export function randomFutureIso(rng: Rng, minDays: number, maxDays: number): string {
  const days = randInt(rng, minDays, maxDays)
  return toIso(new Date(Date.now() + days * 24 * 60 * 60 * 1000))
}
