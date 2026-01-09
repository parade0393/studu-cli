import { ElEmpty, ElTable, ElTableColumn } from 'element-plus'
import { defineComponent, type VNodeChild } from 'vue'
import type { TableColumnDef, TreeTableProps } from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

type Row = unknown

function valueOf(row: Row, col: TableColumnDef<Row>): unknown {
  if (col.valueGetter) return col.valueGetter(row)
  return (row as Record<string, unknown>)[col.key]
}

function renderCell(row: Row, rowIndex: number, col: TableColumnDef<Row>): VNodeChild {
  const Cell = col.cell
  if (Cell) return <Cell row={row} rowIndex={rowIndex} />
  return defaultCellText(valueOf(row, col))
}

function renderColumns(columns: TableColumnDef<Row>[]) {
  return columns.map((col) => (
    <ElTableColumn
      key={col.key}
      prop={col.key}
      label={col.title}
      width={col.width}
      fixed={col.fixed}
      align={col.align}
      showOverflowTooltip
      v-slots={{
        default: ({ row, $index }: { row: Row; $index: number }) => renderCell(row, $index, col),
      }}
    />
  ))
}

export const ElTreeTable = defineComponent<TreeTableProps<Row>>({
  name: 'ElTreeTableAdapter',
  props: {
    roots: { type: Array, required: true },
    rowKey: { type: [String, Function], required: true },
    height: { type: [String, Number], required: true },
    loading: { type: Boolean, default: false },
    border: { type: Boolean, default: true },
    columns: { type: Array, required: true },
    loadChildren: { type: Function, required: true },
    selection: { type: Boolean, default: false },
    selectedRowKeys: { type: Array, required: false },
    onUpdateSelectedRowKeys: { type: Function, required: false },
    onRowClick: { type: Function, required: false },
    filterRow: { type: Function, required: false },
    emptyText: { type: String, required: false },
  },
  setup(props) {
    return () => {
      const rowKeyFn = (row: Row) => getRowKey(props.rowKey, row)
      const roots = props.filterRow
        ? (props.roots as Row[]).filter((r) => props.filterRow?.(r))
        : (props.roots as Row[])
      const columns = props.columns as TableColumnDef<Row>[]

      return (
        <ElTable
          data={roots}
          rowKey={rowKeyFn}
          height={props.height}
          border={props.border}
          lazy
          treeProps={{ hasChildren: 'hasChildren', children: 'children' }}
          load={async (row: Row, _treeNode: unknown, resolve: (rows: Row[]) => void) => {
            const children = await props.loadChildren(row)
            const filtered = props.filterRow
              ? children.filter((c) => props.filterRow?.(c))
              : children
            resolve(filtered)
          }}
          onRow-click={props.onRowClick ? (row: Row) => props.onRowClick?.(row) : undefined}
          onSelection-change={
            props.selection && props.onUpdateSelectedRowKeys
              ? (selectedRows: Row[]) =>
                  props.onUpdateSelectedRowKeys?.(selectedRows.map((r) => rowKeyFn(r)))
              : undefined
          }
          v-slots={{
            default: () => renderColumns(columns),
            empty: () => <ElEmpty description={props.emptyText ?? '暂无数据'} />,
          }}
        />
      )
    }
  },
})
