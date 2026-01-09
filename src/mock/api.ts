import type {
  ExceptionRow,
  FilterRule,
  InventoryRow,
  Picker,
  Query,
  SortRule,
  TreeNode,
} from '../types/benchmark'
import { getExceptions, getInventoryRows, getPickers, getTreeRoots } from './datasets'
import { chance, createRng } from './rng'

type Paged<T> = { rows: T[]; total: number }

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function applySort<T extends Record<string, unknown>>(rows: T[], sort: SortRule[]): T[] {
  if (!sort.length) return rows
  const sorted = [...rows]
  sorted.sort((ra, rb) => {
    for (const rule of sort) {
      const d = compareValues(ra[rule.field], rb[rule.field])
      if (d !== 0) return rule.order === 'asc' ? d : -d
    }
    return 0
  })
  return sorted
}

function applyFilters<T extends Record<string, unknown>>(rows: T[], filters: FilterRule[]): T[] {
  if (!filters.length) return rows

  return rows.filter((row) => {
    for (const f of filters) {
      const v = row[f.field]
      if (f.op === 'textContains') {
        const q = String(f.value ?? '').trim()
        if (!q) continue
        if (
          !String(v ?? '')
            .toLowerCase()
            .includes(q.toLowerCase())
        )
          return false
      } else if (f.op === 'enumIn') {
        const set = Array.isArray(f.value) ? new Set(f.value as unknown[]) : null
        if (set && set.size > 0 && !set.has(v)) return false
      } else if (f.op === 'numberRange') {
        const [min, max] = Array.isArray(f.value)
          ? (f.value as [number | null, number | null])
          : [null, null]
        const num = typeof v === 'number' ? v : Number(v)
        if (min != null && !(num >= min)) return false
        if (max != null && !(num <= max)) return false
      } else if (f.op === 'dateRange') {
        const [start, end] = Array.isArray(f.value)
          ? (f.value as [string | null, string | null])
          : [null, null]
        const t = v ? new Date(String(v)).getTime() : NaN
        const ts = start ? new Date(start).getTime() : null
        const te = end ? new Date(end).getTime() : null
        if (ts != null && !(t >= ts)) return false
        if (te != null && !(t <= te)) return false
      } else if (f.op === 'boolean') {
        if (typeof f.value === 'boolean' && Boolean(v) !== f.value) return false
      }
    }
    return true
  })
}

function paginate<T>(rows: T[], query: Query): Paged<T> {
  const start = (query.page - 1) * query.pageSize
  const end = start + query.pageSize
  return { rows: rows.slice(start, end), total: rows.length }
}

export async function fetchInventory(params: {
  query: Query
  seed: number
  size: number
  columnSize: number
  mode: 'local' | 'server'
}): Promise<Paged<InventoryRow> & { requestMs: number; computeMs: number }> {
  const t0 = performance.now()
  if (params.mode === 'server') {
    await sleep(180 + Math.random() * 420)
  }
  const t1 = performance.now()

  const all = getInventoryRows(params.size, params.seed, params.columnSize)
  const filtered = applyFilters(all, params.query.filters)
  const sorted = applySort(filtered, params.query.sort)
  const paged = paginate(sorted, params.query)
  const t2 = performance.now()

  return { ...paged, requestMs: t1 - t0, computeMs: t2 - t1 }
}

export async function fetchExceptions(params: {
  query: Query
  seed: number
  size: number
  columnSize: number
  mode: 'local' | 'server'
}): Promise<Paged<ExceptionRow> & { requestMs: number; computeMs: number }> {
  const t0 = performance.now()
  if (params.mode === 'server') {
    await sleep(160 + Math.random() * 360)
  }
  const t1 = performance.now()
  const inventory = getInventoryRows(Math.min(params.size, 20000), params.seed, params.columnSize)
  const all = getExceptions(params.size, params.seed, inventory)
  const filtered = applyFilters(all, params.query.filters)
  const sorted = applySort(filtered, params.query.sort)
  const paged = paginate(sorted, params.query)
  const t2 = performance.now()
  return { ...paged, requestMs: t1 - t0, computeMs: t2 - t1 }
}

export async function fetchTreeRoots(params: { seed: number }): Promise<TreeNode[]> {
  await sleep(80)
  return getTreeRoots(params.seed)
}

export async function fetchTreeChildren(params: {
  seed: number
  parentId: string
}): Promise<TreeNode[]> {
  const rng = createRng(params.seed ^ hashString(params.parentId))
  await sleep(120 + rng() * 380)

  if (chance(rng, 0.02)) {
    throw new Error('Mock: loadChildren failed')
  }

  const parentLevel = detectLevel(params.parentId)
  const nextLevel = parentLevel + 1

  if (nextLevel === 1) {
    return Array.from({ length: 6 }, (_, i) => ({
      id: `${params.parentId}-Z${String(i + 1).padStart(2, '0')}`,
      parentId: params.parentId,
      type: 'zone',
      name: `Z${String(i + 1).padStart(2, '0')}`,
      hasChildren: true,
      level: nextLevel,
    }))
  }

  if (nextLevel === 2) {
    return Array.from({ length: 80 }, (_, i) => ({
      id: `${params.parentId}-B${String(i + 1).padStart(4, '0')}`,
      parentId: params.parentId,
      type: 'bin',
      name: `B${String(i + 1).padStart(4, '0')}`,
      hasChildren: true,
      level: nextLevel,
      availableSum: Math.floor(rng() * 4000),
    }))
  }

  if (nextLevel === 3) {
    const n = Math.floor(rng() * 16)
    return Array.from({ length: n }, (_, i) => {
      const days = Math.floor(rng() * 365) - 30
      const expireAtMin = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      return {
        id: `${params.parentId}-BS${String(i + 1).padStart(2, '0')}`,
        parentId: params.parentId,
        type: 'batchStock',
        name: `批次库存-${String(i + 1).padStart(2, '0')}`,
        hasChildren: false,
        level: nextLevel,
        availableSum: Math.floor(rng() * 500),
        expireAtMin,
      }
    })
  }

  return []
}

export async function searchPickers(params: { seed: number; q: string }): Promise<Picker[]> {
  await sleep(120 + Math.random() * 180)
  const q = params.q.trim().toLowerCase()
  const all = getPickers(params.seed)
  if (!q) return all.slice(0, 20)
  return all
    .filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    .slice(0, 20)
}

export async function validatePicker(params: {
  seed: number
  pickerId: string
  lineId: string
}): Promise<{ ok: boolean; message?: string }> {
  const rng = createRng(params.seed ^ hashString(params.pickerId + params.lineId))
  await sleep(150 + rng() * 450)
  if (chance(rng, 0.05)) return { ok: false, message: '拣货人无效或不可接单' }
  return { ok: true }
}

export async function submitPicking(params: {
  seed: number
  lines: { lineId: string }[]
}): Promise<{ results: { lineId: string; ok: boolean; message?: string }[]; requestMs: number }> {
  const t0 = performance.now()
  await sleep(220 + Math.random() * 600)
  const rng = createRng(params.seed ^ 0x515041)
  const results = params.lines.map((l) =>
    chance(rng, 0.08)
      ? { lineId: l.lineId, ok: false, message: '提交失败：资源冲突' }
      : { lineId: l.lineId, ok: true },
  )
  const t1 = performance.now()
  return { results, requestMs: t1 - t0 }
}

export async function exceptionAction(params: {
  seed: number
  action: 'process' | 'assign' | 'create-adjustment'
  id: string
}): Promise<{ ok: boolean; message?: string }> {
  const rng = createRng(params.seed ^ hashString(params.action + params.id))
  await sleep(120 + rng() * 380)
  if (chance(rng, 0.03)) return { ok: false, message: '操作失败：请重试' }
  return { ok: true }
}

export async function fetchExceptionTimeline(params: {
  seed: number
  id: string
}): Promise<{ at: string; text: string }[]> {
  const rng = createRng(params.seed ^ hashString('timeline' + params.id))
  await sleep(100 + rng() * 260)
  const n = 3 + Math.floor(rng() * 6)
  return Array.from({ length: n }, (_, i) => ({
    at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
    text: `操作记录 ${i + 1}`,
  }))
}

function detectLevel(id: string): number {
  const parts = id.split('-')
  return Math.max(0, parts.length - 3)
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
