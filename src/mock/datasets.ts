import type { ExceptionRow, InventoryRow, Picker, TreeNode } from '../types/benchmark'
import { addDaysIso, randomPastIso, randomFutureIso, toIso } from './datetime'
import { chance, createRng, pickOne, randInt } from './rng'

type CacheKey = string

const inventoryCache = new Map<CacheKey, InventoryRow[]>()
const pickerCache = new Map<CacheKey, Picker[]>()
const exceptionsCache = new Map<CacheKey, ExceptionRow[]>()

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

function riskLevelFromExpire(expireAtIso: string): 1 | 2 | 3 | 4 | 5 {
  const expireAt = new Date(expireAtIso).getTime()
  const diffDays = Math.floor((expireAt - Date.now()) / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return 5
  if (diffDays <= 7) return 4
  if (diffDays <= 30) return 3
  if (diffDays <= 90) return 2
  return 1
}

export function getPickers(seed: number): Picker[] {
  const key = String(seed)
  const cached = pickerCache.get(key)
  if (cached) return cached

  const rng = createRng(seed ^ 0xa11ce)
  const names = ['张三', '李四', '王五', '赵六', '陈七', '周八', '钱九', '孙十', '吴一', '郑二']
  const pickers: Picker[] = Array.from({ length: 120 }, (_, i) => {
    const suffix = pad(i + 1, 3)
    return { id: `P${suffix}`, name: `${pickOne(rng, names)}-${suffix}` }
  })
  pickerCache.set(key, pickers)
  return pickers
}

export function getInventoryRows(size: number, seed: number, columnSize: number): InventoryRow[] {
  const key = `${size}|${seed}|${columnSize}`
  const cached = inventoryCache.get(key)
  if (cached) return cached

  const rng = createRng(seed)
  const warehouses = ['WH-A', 'WH-B', 'WH-C']
  const zones = Array.from({ length: 6 }, (_, i) => `Z${pad(i + 1, 2)}`)
  const owners = ['Owner-A', 'Owner-B', 'Owner-C']
  const suppliers = ['Supplier-A', 'Supplier-B', 'Supplier-C', 'Supplier-D']

  const rows: InventoryRow[] = []

  const skuCount = 1000
  for (let i = 0; i < size; i++) {
    const skuIndex = randInt(rng, 1, skuCount)
    const sku = `SKU${pad(skuIndex, 6)}`
    const skuName = `商品-${pad(skuIndex, 4)}-${pickOne(rng, ['标准', '加固', '轻量', '组合', '冷链'])}`
    const batch = `BATCH-${toIso(new Date()).slice(0, 10).replace(/-/g, '')}-${pad(randInt(rng, 1, 5), 2)}`
    const warehouse = pickOne(rng, warehouses)
    const zone = pickOne(rng, zones)
    const bin = `B${pad(randInt(rng, 1, 80), 4)}`

    const inboundAt = randomPastIso(rng, 180)
    const lastMoveAt = addDaysIso(inboundAt, randInt(rng, 0, 90))
    const expireAt = randomFutureIso(rng, -30, 365)

    const qualityStatus = chance(rng, 0.8) ? 'OK' : chance(rng, 0.75) ? 'HOLD' : 'NG'
    const freezeStatus = chance(rng, 0.85) ? 'NONE' : 'FROZEN'
    const abcClass = chance(rng, 0.2) ? 'A' : chance(rng, 0.375) ? 'B' : 'C'

    const onHand = randInt(rng, 0, 500)
    const reserved = randInt(rng, 0, Math.min(200, onHand))
    const damaged = randInt(rng, 0, Math.min(20, Math.max(0, onHand - reserved)))
    const frozen = freezeStatus === 'FROZEN' ? randInt(rng, 10, Math.min(100, onHand)) : 0
    const available = Math.max(0, onHand - reserved - damaged - frozen)

    const row: InventoryRow = {
      id: `INV-${seed}-${i + 1}`,
      warehouse,
      zone,
      bin,
      sku,
      skuName,
      batch,
      owner: pickOne(rng, owners),
      supplier: pickOne(rng, suppliers),
      qualityStatus,
      freezeStatus,
      abcClass,
      riskLevel: riskLevelFromExpire(expireAt),
      onHand,
      available,
      reserved,
      damaged,
      frozen,
      inboundAt,
      lastMoveAt,
      expireAt,
    }

    row.extText1 = `文本-${pad((i + 1) % 9999, 4)}`
    row.extText2 = `文本-${pad((i + 2) % 9999, 4)}`
    row.extEnum1 = pickOne(rng, ['E1', 'E2', 'E3', 'E4'])
    row.extEnum2 = pickOne(rng, ['E1', 'E2', 'E3', 'E4'])
    row.extNum1 = randInt(rng, 0, 10000)
    row.extNum2 = randInt(rng, 0, 10000)
    row.extDate1 = randomPastIso(rng, 365)

    const extraCount = Math.max(0, columnSize - 30)
    for (let extra = 1; extra <= extraCount; extra++) {
      const mod = extra % 4
      if (mod === 0) row[`extText${extra + 2}`] = `文本-${pad((i + extra) % 9999, 4)}`
      if (mod === 1) row[`extEnum${extra + 2}`] = pickOne(rng, ['E1', 'E2', 'E3', 'E4'])
      if (mod === 2) row[`extNum${extra + 2}`] = randInt(rng, 0, 10000)
      if (mod === 3) row[`extDate${extra + 1}`] = randomPastIso(rng, 365)
    }

    rows.push(row)
  }

  rows.sort((a, b) => (a.sku + a.batch).localeCompare(b.sku + b.batch))

  inventoryCache.set(key, rows)
  return rows
}

export function getTreeRoots(seed: number): TreeNode[] {
  const warehouses = ['WH-A', 'WH-B', 'WH-C']
  return warehouses.map((w) => ({
    id: `TREE-${seed}-${w}`,
    type: 'warehouse',
    name: w,
    hasChildren: true,
    level: 0,
  }))
}

export function getExceptions(
  size: number,
  seed: number,
  inventory: InventoryRow[],
): ExceptionRow[] {
  const key = `${size}|${seed}|ex`
  const cached = exceptionsCache.get(key)
  if (cached) return cached

  const rng = createRng(seed ^ 0x0e7710)
  const rows: ExceptionRow[] = []

  const nowIso = toIso(new Date())
  for (let i = 0; i < Math.min(size, inventory.length); i++) {
    const inv = inventory[i]!
    const type: ExceptionRow['type'] =
      inv.available === 0 && inv.reserved > 0
        ? 'SHORT'
        : inv.freezeStatus === 'FROZEN'
          ? 'FROZEN'
          : inv.riskLevel >= 4
            ? 'EXPIRE_RISK'
            : chance(rng, 0.03)
              ? 'COUNT_DIFF'
              : chance(rng, 0.02)
                ? 'SHORT'
                : 'COUNT_DIFF'

    const status: ExceptionRow['status'] = chance(rng, 0.7)
      ? 'OPEN'
      : chance(rng, 0.7)
        ? 'PROCESSING'
        : 'DONE'
    rows.push({
      id: `EX-${seed}-${i + 1}`,
      type,
      sku: inv.sku,
      skuName: inv.skuName,
      bin: inv.bin,
      riskLevel: inv.riskLevel,
      createdAt: nowIso,
      status,
      assignee: chance(rng, 0.6) ? null : `P${pad(randInt(rng, 1, 20), 3)}`,
      message: `异常说明：${type}（来源 ${inv.warehouse}/${inv.zone}/${inv.bin}）`,
    })
  }

  exceptionsCache.set(key, rows)
  return rows
}
