import type { VNodeChild } from 'vue'
import type { RowKey } from './types'

export function getRowKey<Row>(rowKey: RowKey<Row>, row: Row): string {
  if (typeof rowKey === 'function') return rowKey(row)
  const v = row[rowKey]
  return typeof v === 'string' ? v : String(v)
}

export function defaultCellText(v: unknown): VNodeChild {
  if (v == null) return ''
  return String(v)
}
