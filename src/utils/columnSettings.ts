import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { TableColumnDef, TableFixed, TableHeaderGroup } from '../adapters/table/types'
import type { LibraryMode } from '../stores/benchmark'

type ColumnVisibility = Record<string, boolean>

type ColumnSettingsResult<Row> = {
  order: Ref<string[]>
  visibility: Ref<ColumnVisibility>
  orderedAll: ComputedRef<TableColumnDef<Row>[]>
  visibleColumns: ComputedRef<TableColumnDef<Row>[]>
  reset: () => void
  showAll: () => void
}

type ColumnList<Row> = Ref<TableColumnDef<Row>[]> | ComputedRef<TableColumnDef<Row>[]>

function ensureOrder(keys: string[], order: string[]) {
  const next = order.filter((key) => keys.includes(key))
  for (const key of keys) {
    if (!next.includes(key)) next.push(key)
  }
  return next
}

export function normalizeColumnOrder(
  columns: Array<{ key: string; fixed?: TableFixed }>,
  order: string[],
) {
  const keys = ensureOrder(
    columns.map((col) => col.key),
    order,
  )
  const fixedMap = new Map(columns.map((col) => [col.key, col.fixed]))
  const left: string[] = []
  const center: string[] = []
  const right: string[] = []
  for (const key of keys) {
    const fixed = fixedMap.get(key)
    if (fixed === 'left') left.push(key)
    else if (fixed === 'right') right.push(key)
    else center.push(key)
  }
  return [...left, ...center, ...right]
}

function ensureVisibility(keys: string[], visibility: ColumnVisibility) {
  const next: ColumnVisibility = {}
  for (const key of keys) {
    next[key] = visibility[key] ?? true
  }
  return next
}

export function useColumnSettings<Row>(columns: ColumnList<Row>): ColumnSettingsResult<Row> {
  const order = ref<string[]>([])
  const visibility = ref<ColumnVisibility>({})

  const columnMap = computed(() => new Map(columns.value.map((col) => [col.key, col])))

  function syncFromColumns() {
    const keys = columns.value.map((col) => col.key)
    order.value = order.value.length ? ensureOrder(keys, order.value) : [...keys]
    visibility.value = ensureVisibility(keys, visibility.value)
  }

  function reset() {
    const keys = columns.value.map((col) => col.key)
    order.value = [...keys]
    visibility.value = ensureVisibility(keys, {})
  }

  function showAll() {
    const keys = columns.value.map((col) => col.key)
    visibility.value = ensureVisibility(keys, {})
  }

  watch(columns, syncFromColumns, { immediate: true, deep: true })

  const orderedAll = computed<TableColumnDef<Row>[]>(() => {
    const keys = normalizeColumnOrder(columns.value, order.value)
    const map = columnMap.value
    const ordered = keys.map((key) => map.get(key)).filter(Boolean) as TableColumnDef<Row>[]
    const fallback = columns.value.filter((col) => !keys.includes(col.key))
    return [...ordered, ...fallback]
  })

  const visibleColumns = computed<TableColumnDef<Row>[]>(() =>
    orderedAll.value.filter((col) => visibility.value[col.key] !== false),
  )

  return { order, visibility, orderedAll, visibleColumns, reset, showAll }
}

export function applyColumnSettingsToGroups<Row>(
  groups: TableHeaderGroup<Row>[],
  order: string[],
  visibility: ColumnVisibility,
): TableHeaderGroup<Row>[] {
  const flatColumns = groups.flatMap((group) => group.columns)
  const normalized = normalizeColumnOrder(flatColumns, order)
  const orderMap = new Map(normalized.map((key, index) => [key, index]))
  const next = groups
    .map((group) => {
      const columns = group.columns
        .filter((col) => visibility[col.key] !== false)
        .sort(
          (a, b) =>
            (orderMap.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
            (orderMap.get(b.key) ?? Number.MAX_SAFE_INTEGER),
        )
      const orderIndex = columns.length
        ? Math.min(...columns.map((col) => orderMap.get(col.key) ?? Number.MAX_SAFE_INTEGER))
        : Number.MAX_SAFE_INTEGER
      return { title: group.title, columns, orderIndex }
    })
    .filter((group) => group.columns.length)
    .sort((a, b) => a.orderIndex - b.orderIndex)
  return next.map(({ title, columns }) => ({ title, columns }))
}

export function getColumnSupportText(mode: LibraryMode) {
  switch (mode) {
    case 'ag-grid':
      return '列显隐：内建 Column API（setColumnsVisible/column state）；列顺序：内建 Column API（moveColumns/applyColumnState）；Community 无内建管理面板，当前示例用自研面板 + 受控 columns 实现。'
    case 'tanstack-table':
      return '列显隐：内建 columnVisibility 状态；列顺序：内建 columnOrder 状态；UI 需自研，当前示例用自研面板 + 受控 columns 实现。'
    case 'vxe-table':
      return '列显隐：内建列自定义（toolbar.customConfig）；列顺序：内建列自定义支持拖拽排序（需开启）；当前示例用自研面板 + 受控 columns 实现。'
    case 'el-table':
      return '列显隐：无内建；列顺序：无内建（需自行调整 columns 顺序）；当前示例用自研面板 + 受控 columns 实现。'
    case 'el-table-v2':
      return '列显隐：内建 Column.hidden（当前示例用过滤 columns 实现）；列顺序：无内建（需自行调整 columns 顺序）；当前示例用自研面板 + 受控 columns 实现。'
    case 'ant-table':
      return '列显隐：无内建；列顺序：无内建（需自行调整 columns 顺序）；当前示例用自研面板 + 受控 columns 实现。'
    default:
      return '列显隐：当前示例用受控 columns 实现；列顺序：当前示例用受控 columns 实现。'
  }
}
