import { ElMessage } from 'element-plus'
import type { InventoryRow } from '../types/benchmark'
import type { TableColumnDef, TableCellCtx } from '../adapters/table/types'
import { formatDateTime, formatNumber } from '../utils/format'
import type { InventoryColumnSpec } from './inventory'
import type { FunctionalComponent } from 'vue'

function asIsoString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

export function buildInventoryColumns(
  specs: InventoryColumnSpec[],
): TableColumnDef<InventoryRow>[] {
  const out: TableColumnDef<InventoryRow>[] = []

  const makeLink = (text: string, onClick: () => void) => (
    <a class="link" onClick={onClick}>
      {text}
    </a>
  )

  const cellText: FunctionalComponent<TableCellCtx<InventoryRow>> = ({ row, rowIndex }) => (
    <span title={`${row.sku}-${rowIndex}`}>{row.sku}</span>
  )

  for (const s of specs) {
    const key = String(s.key)
    const filter =
      key === 'sku'
        ? { type: 'text', placeholder: '搜索 SKU' }
        : key === 'qualityStatus'
          ? {
              type: 'select',
              options: [
                { label: 'OK', value: 'OK' },
                { label: 'HOLD', value: 'HOLD' },
                { label: 'NG', value: 'NG' },
              ],
            }
          : key === 'expireAt'
            ? { type: 'date' }
            : key === 'riskLevel'
              ? { type: 'custom', key: 'riskMin', label: '风险等级' }
              : undefined
    const base: TableColumnDef<InventoryRow> = {
      key,
      title: s.title,
      width: s.width,
      align: s.align,
      fixed: s.fixed,
      filter,
      sortable:
        ['available', 'onHand', 'expireAt', 'riskLevel'].includes(key) || key.startsWith('ext'),
    }

    if (key === 'opView') {
      out.push({
        ...base,
        valueGetter: () => '',
        cell: ({ row }) =>
          makeLink('查看', () => ElMessage.info(`查看：${row.sku} / ${row.batch}`)),
      })
      continue
    }

    if (key === 'opCopySku') {
      out.push({
        ...base,
        valueGetter: () => '',
        cell: ({ row }) =>
          makeLink('复制', async () => {
            await navigator.clipboard.writeText(row.sku)
            ElMessage.success('已复制 SKU')
          }),
      })
      continue
    }
    if (key === 'qualityStatus') {
      out.push({
        ...base,
        cell: ({ row }) => {
          const qs = row.qualityStatus ?? 'UNKNOWN'
          const cls =
            qs === 'OK'
              ? 'tag-ok'
              : qs === 'HOLD'
                ? 'tag-hold'
                : qs === 'NG'
                  ? 'tag-ng'
                  : 'tag-info'
          return <span class={`tag ${cls}`}>{qs}</span>
        },
      })
      continue
    }

    if (key === 'freezeStatus') {
      out.push({
        ...base,
        cell: ({ row }) => (
          <span class={`tag tag-${row.freezeStatus === 'FROZEN' ? 'warn' : 'info'}`}>
            {row.freezeStatus}
          </span>
        ),
      })
      continue
    }

    if (key === 'abcClass') {
      out.push({ ...base, cell: ({ row }) => <span class="tag tag-info">{row.abcClass}</span> })
      continue
    }

    if (key === 'riskLevel') {
      out.push({
        ...base,
        cell: ({ row }) => (
          <span class="risk" data-level={row.riskLevel}>
            L{row.riskLevel}{' '}
          </span>
        ),
      })
      continue
    }

    if (key.endsWith('At') || key === 'expireAt' || key.startsWith('extDate')) {
      out.push({
        ...base,
        valueGetter: (r) =>
          formatDateTime(asIsoString((r as unknown as Record<string, unknown>)[key])),
      })
      continue
    }

    if (
      ['onHand', 'available', 'reserved', 'damaged', 'frozen'].includes(key) ||
      key.startsWith('extNum')
    ) {
      out.push({
        ...base,
        cell: ({ row }) => {
          const v = (row as Record<string, unknown>)[key]
          const n = typeof v === 'number' ? v : Number(v)
          const cls = key === 'available' && row.available <= 5 ? 'num warn' : 'num'
          return <span class={cls}>{formatNumber(Number.isFinite(n) ? n : null)}</span>
        },
      })
      continue
    }
    if (key === 'sku') {
      out.push({ ...base, cell: cellText })
      continue
    }

    out.push({ ...base })
  }
  return out
}
