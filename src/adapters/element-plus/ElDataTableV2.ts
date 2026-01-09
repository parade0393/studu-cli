import { ElAutoResizer, ElCheckbox, ElTableV2 } from 'element-plus'
import { TableV2FixedDir, TableV2SortOrder } from 'element-plus'
import type { SortBy } from 'element-plus'
import { defineComponent, h, isVNode, type Component, type VNode } from 'vue'
import type {
  DataTableProps,
  TableColumnDef,
  TableHeaderGroup,
  TableSortRule,
} from '../table/types'
import { defaultCellText, getRowKey } from '../table/types'
import type { TableV2CustomizedHeaderSlotParam } from 'element-plus'
import type { Column as V2Column } from 'element-plus/es/components/table-v2/src/types'

type Row = unknown

function valueOf(row: Row, col: TableColumnDef<Row>): unknown {
  if (col.valueGetter) return col.valueGetter(row)
  return (row as Record<string, unknown>)[col.key]
}

function toV2Sort(sort: TableSortRule[] | undefined): SortBy | undefined {
  const s = sort?.[0]
  if (!s) return undefined
  return { key: s.key, order: s.order === 'asc' ? TableV2SortOrder.ASC : TableV2SortOrder.DESC }
}

function fromV2Sort(sortBy: SortBy): TableSortRule[] {
  if (!sortBy.key || !sortBy.order) return []
  return [
    { key: String(sortBy.key), order: sortBy.order === TableV2SortOrder.ASC ? 'asc' : 'desc' },
  ]
}

function renderCell(row: Row, rowIndex: number, col: TableColumnDef<Row>) {
  if (col.cell) return h(col.cell, { row, rowIndex })
  return defaultCellText(valueOf(row, col))
}

function wrapVNode(child: unknown): VNode {
  if (isVNode(child)) return child
  if (child == null || child === false) return h('span', null, '')
  return h('span', null, String(child))
}

function buildHeaderRenderer(groups: TableHeaderGroup<Row>[]) {
  const keyToGroup = new Map<string, string>()
  for (const g of groups) {
    for (const c of g.columns) keyToGroup.set(c.key, g.title)
  }

  return ({ cells, columns, headerIndex }: TableV2CustomizedHeaderSlotParam) => {
    if (headerIndex === 1) return cells

    const groupCells: unknown[] = []
    let width = 0
    let currentLabel = ''

    const flush = (label: string) => {
      groupCells.push(
        h(
          'div',
          {
            role: 'columnheader',
            style: {
              width: `${width}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              borderRight: '1px solid var(--el-border-color)',
              background: 'var(--el-fill-color-light)',
            },
          },
          label,
        ),
      )
      width = 0
    }

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      if (!col) continue
      const key = String(col.dataKey ?? col.key ?? '')
      const label = key === '__sel' ? '' : (keyToGroup.get(key) ?? '')
      if (i === 0) currentLabel = label

      width += Number(col.width ?? 0)

      const next = columns[i + 1]
      const nextKey = next ? String(next.dataKey ?? next.key ?? '') : ''
      const nextLabel = nextKey === '__sel' ? '' : (keyToGroup.get(nextKey) ?? '')
      if (i === columns.length - 1 || nextLabel !== currentLabel) {
        flush(currentLabel)
        currentLabel = nextLabel
      }
    }

    return groupCells
  }
}

export const ElDataTableV2 = defineComponent<DataTableProps<Row>>({
  name: 'ElDataTableV2Adapter',
  props: {
    rows: { type: Array, required: true },
    rowKey: { type: [String, Function], required: true },
    height: { type: [String, Number], required: true },
    loading: { type: Boolean, default: false },
    border: { type: Boolean, default: true },
    columns: { type: Array, required: true },
    headerGroups: { type: Array, required: false },
    selection: { type: Boolean, default: false },
    selectedRowKeys: { type: Array, required: false },
    onUpdateSelectedRowKeys: { type: Function, required: false },
    sort: { type: Array, required: false },
    onUpdateSort: { type: Function, required: false },
    spanMethod: { type: Function, required: false },
    emptyText: { type: String, required: false },
  },
  setup(props) {
    return () => {
      const TableV2Comp: Component = ElTableV2
      const data = props.rows as Row[]
      const rowKey = (r: Row) => getRowKey(props.rowKey, r)
      const selected = new Set(props.selectedRowKeys ?? [])

      const columns: V2Column<Row>[] = []

      if (props.selection && props.onUpdateSelectedRowKeys) {
        columns.push({
          key: '__sel',
          dataKey: '__sel',
          title: '',
          width: 48,
          fixed: TableV2FixedDir.LEFT,
          headerCellRenderer: () => {
            const all = data.length > 0 && data.every((r) => selected.has(rowKey(r)))
            return h(ElCheckbox, {
              modelValue: all,
              'onUpdate:modelValue': (v: unknown) => {
                const checked = v === true
                const keys = checked ? data.map((r) => rowKey(r)) : []
                props.onUpdateSelectedRowKeys?.(keys)
              },
            })
          },
          cellRenderer: ({ rowData }) =>
            wrapVNode(
              h(ElCheckbox, {
                modelValue: selected.has(rowKey(rowData)),
                'onUpdate:modelValue': (v: unknown) => {
                  const checked = v === true
                  const next = new Set(selected)
                  const k = rowKey(rowData)
                  if (checked) next.add(k)
                  else next.delete(k)
                  props.onUpdateSelectedRowKeys?.([...next])
                },
              }),
            ),
        })
      }

      const defs = props.columns as TableColumnDef<Row>[]
      for (const d of defs) {
        columns.push({
          key: d.key,
          dataKey: d.key,
          title: d.title,
          width: d.width,
          align: d.align,
          fixed: d.fixed
            ? d.fixed === 'left'
              ? TableV2FixedDir.LEFT
              : TableV2FixedDir.RIGHT
            : undefined,
          sortable: d.sortable,
          cellRenderer: ({ rowData, rowIndex }) =>
            wrapVNode(renderCell(rowData, typeof rowIndex === 'number' ? rowIndex : 0, d)),
        })
      }

      const v2Sort = toV2Sort(props.sort)
      const headerGroups = props.headerGroups as TableHeaderGroup<Row>[] | undefined
      const headerRenderer =
        headerGroups && headerGroups.length ? buildHeaderRenderer(headerGroups) : undefined
      const headerHeight = headerRenderer ? [40, 40] : 40

      const tableProps: Record<string, unknown> = {
        columns,
        data,
        fixed: true,
        headerHeight,
        onColumnSort: props.onUpdateSort
          ? (sb: SortBy) => props.onUpdateSort?.(fromV2Sort(sb))
          : undefined,
      }
      if (v2Sort) tableProps.sortBy = v2Sort

      return h(
        'div',
        {
          style: {
            height: typeof props.height === 'number' ? `${props.height}px` : props.height,
            width: '100%',
          },
        },
        h(ElAutoResizer, null, {
          default: ({ height, width }: { height: number; width: number }) =>
            h(
              TableV2Comp,
              {
                ...tableProps,
                width,
                height,
              },
              headerRenderer
                ? { header: (p: TableV2CustomizedHeaderSlotParam) => headerRenderer(p) }
                : {},
            ),
        }),
      )
    }
  },
})
