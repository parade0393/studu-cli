import { ElEmpty, ElTable, ElTableColumn } from 'element-plus'
import { defineComponent, type VNodeChild } from 'vue'
import type {
  DataTableProps,
  TableColumnDef,
  TableHeaderGroup,
  TableSortRule,
} from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

function toElementSort(
  sort: TableSortRule[] | undefined,
): { prop: string; order: 'ascending' | 'descending' } | undefined {
  const rule = sort?.[0]
  if (!rule) return undefined
  return { prop: rule.key, order: rule.order === 'asc' ? 'ascending' : 'descending' }
}

function fromElementSort(e: {
  prop: string
  order: 'ascending' | 'descending' | null
}): TableSortRule[] {
  if (!e.order) return []
  return [{ key: e.prop, order: e.order === 'ascending' ? 'asc' : 'desc' }]
}

function valueOf<Row>(row: Row, col: TableColumnDef<Row>): unknown {
  if (col.valueGetter) return col.valueGetter(row)
  return (row as unknown as Record<string, unknown>)[col.key]
}

function renderCell<Row>(row: Row, rowIndex: number, col: TableColumnDef<Row>): VNodeChild {
  try {
    const Cell = col.cell
    if (Cell) return <Cell row={row} rowIndex={rowIndex} />
    return defaultCellText(valueOf(row, col))
  } catch (e) {
    console.error('[ElDataTable] cell render error', { columnKey: col.key, rowIndex, error: e })
    return <span style={{ color: 'var(--el-color-danger)' }}>RenderError</span>
  }
}

function renderColumns<Row>(columns: TableColumnDef<Row>[]) {
  return columns.map((col) => {
    const Header = col.headerCell
    return (
      <ElTableColumn
        key={col.key}
        prop={col.key}
        label={col.title}
        width={col.width}
        fixed={col.fixed}
        align={col.align}
        sortable={col.sortable ? 'custom' : false}
        showOverflowTooltip
        v-slots={{
          default: ({ row, $index }: { row: Row; $index: number }) => renderCell(row, $index, col),
          header: Header ? () => <Header /> : undefined,
        }}
      />
    )
  })
}

function renderGroupedColumns<Row>(groups: TableHeaderGroup<Row>[]) {
  return groups.map((g) => (
    <ElTableColumn
      key={g.title}
      label={g.title}
      v-slots={{ default: () => renderColumns(g.columns) }}
    />
  ))
}

export const ElDataTable = defineComponent<DataTableProps<unknown>>({
  name: 'ElDataTableAdapter',
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
      const rowKeyFn = (row: unknown) => getRowKey(props.rowKey, row)
      const columns = props.columns as TableColumnDef<unknown>[]

      const spanMethod =
        props.spanMethod &&
        ((p: { row: unknown; rowIndex: number; column: { property?: string } }) => {
          const key = p.column.property
          if (!key) return { rowspan: 1, colspan: 1 }
          return props.spanMethod?.({ row: p.row, rowIndex: p.rowIndex, columnKey: key })
        })

      const grouped = Array.isArray(props.headerGroups) && props.headerGroups.length > 0

      return (
        <ElTable
          data={props.rows}
          rowKey={rowKeyFn}
          height={props.height}
          border={props.border}
          defaultSort={toElementSort(props.sort)}
          spanMethod={spanMethod || undefined}
          emptyText={props.emptyText}
          onSort-change={
            props.onUpdateSort
              ? (e: { prop: string; order: 'ascending' | 'descending' | null }) =>
                  props.onUpdateSort?.(fromElementSort(e))
              : undefined
          }
          onSelection-change={
            props.selection && props.onUpdateSelectedRowKeys
              ? (selectedRows: unknown[]) => {
                  const keys = selectedRows.map((r) => rowKeyFn(r))
                  props.onUpdateSelectedRowKeys?.(keys)
                }
              : undefined
          }
          v-slots={{
            default: () => (
              <>
                {props.selection && props.onUpdateSelectedRowKeys ? (
                  <ElTableColumn
                    type="selection"
                    width={50}
                    fixed="left"
                    selectable={() => true}
                    reserveSelection
                  />
                ) : null}
                {grouped
                  ? renderGroupedColumns(props.headerGroups as TableHeaderGroup<unknown>[])
                  : renderColumns(columns)}
              </>
            ),
            empty: () => <ElEmpty description={props.emptyText ?? '暂无数据'} />,
          }}
        />
      )
    }
  },
})
