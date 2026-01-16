import { Table, Spin, Empty } from 'ant-design-vue'
import type { ColumnType, ColumnGroupType } from 'ant-design-vue/es/table'
import type { SorterResult } from 'ant-design-vue/es/table/interface'
import { defineComponent, computed, type VNodeChild } from 'vue'
import type {
  DataTableProps,
  TableColumnDef,
  TableHeaderGroup,
  TableSortRule,
} from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

type Row = unknown

function toAntSort(
  sort: TableSortRule[] | undefined,
): { field: string; order: 'ascend' | 'descend' } | undefined {
  const rule = sort?.[0]
  if (!rule) return undefined
  return { field: rule.key, order: rule.order === 'asc' ? 'ascend' : 'descend' }
}

function fromAntSort(sorter: SorterResult<Row> | SorterResult<Row>[]): TableSortRule[] {
  const s = Array.isArray(sorter) ? sorter[0] : sorter
  if (!s?.order || !s?.columnKey) return []
  return [{ key: String(s.columnKey), order: s.order === 'ascend' ? 'asc' : 'desc' }]
}

function valueOf(row: Row, col: TableColumnDef<Row>): unknown {
  if (col.valueGetter) return col.valueGetter(row)
  return (row as Record<string, unknown>)[col.key]
}

function renderCell(row: Row, rowIndex: number, col: TableColumnDef<Row>): VNodeChild {
  try {
    const Cell = col.cell
    if (Cell) return <Cell row={row} rowIndex={rowIndex} />
    return defaultCellText(valueOf(row, col))
  } catch (e) {
    console.error('[AntDataTable] cell render error', { columnKey: col.key, rowIndex, error: e })
    return <span style={{ color: '#ff4d4f' }}>RenderError</span>
  }
}

function buildColumns(
  columns: TableColumnDef<Row>[],
  sort: TableSortRule[] | undefined,
  spanMethod?: DataTableProps<Row>['spanMethod'],
): ColumnType<Row>[] {
  const currentSort = toAntSort(sort)
  return columns.map((col) => {
    const Header = col.headerCell
    const column: ColumnType<Row> = {
      key: col.key,
      dataIndex: col.key,
      title: Header ? () => <Header /> : col.title,
      width: col.width,
      fixed: col.fixed,
      align: col.align,
      ellipsis: { showTitle: true },
      sorter: col.sortable ? true : undefined,
      sortOrder: col.sortable && currentSort?.field === col.key ? currentSort.order : undefined,
      customRender: ({ record, index }) => renderCell(record, index, col),
      customCell: spanMethod
        ? (record, rowIndex) => {
            if (rowIndex == null) return {}
            const span = spanMethod({ row: record, rowIndex, columnKey: col.key })
            return { rowSpan: span.rowspan, colSpan: span.colspan }
          }
        : undefined,
    }
    return column
  })
}

function buildGroupedColumns(
  groups: TableHeaderGroup<Row>[],
  sort: TableSortRule[] | undefined,
  spanMethod?: DataTableProps<Row>['spanMethod'],
): ColumnGroupType<Row>[] {
  return groups.map((g) => ({
    title: g.title,
    children: buildColumns(g.columns, sort, spanMethod),
  }))
}

export const AntDataTable = defineComponent<DataTableProps<Row>>({
  name: 'AntDataTableAdapter',
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
    const rowKeyFn = (row: Row) => getRowKey(props.rowKey, row)

    const tableColumns = computed(() => {
      const defs = props.columns as TableColumnDef<Row>[]
      const groups = props.headerGroups as TableHeaderGroup<Row>[] | undefined

      const indexCol: ColumnType<Row> = {
        key: '_index',
        title: '#',
        width: 50,
        fixed: 'left',
        align: 'center',
        customRender: ({ index }) => index + 1,
      }

      const baseColumns =
        groups && groups.length > 0
          ? buildGroupedColumns(groups, props.sort, props.spanMethod)
          : buildColumns(defs, props.sort, props.spanMethod)

      return [indexCol, ...baseColumns]
    })

    const rowSelection = computed(() => {
      if (!props.selection || !props.onUpdateSelectedRowKeys) return undefined
      return {
        type: 'checkbox' as const,
        selectedRowKeys: props.selectedRowKeys ?? [],
        onChange: (keys: (string | number)[]) => {
          props.onUpdateSelectedRowKeys?.(keys.map(String))
        },
        columnWidth: 50,
        fixed: 'left' as const,
      }
    })

    const scrollY = computed(() => {
      if (typeof props.height === 'number') return props.height - 55
      const match = String(props.height).match(/calc\((.+)\s*-\s*(\d+)px\)/)
      if (match) {
        const offset = match[2] ? parseInt(match[2]) : 0
        return `calc(${match[1]} - ${offset + 55}px)`
      }
      return props.height
    })

    const handleChange = (
      _pagination: unknown,
      _filters: unknown,
      sorter: SorterResult<Row> | SorterResult<Row>[],
    ) => {
      if (props.onUpdateSort) {
        props.onUpdateSort(fromAntSort(sorter))
      }
    }

    return () => {
      const data = props.rows as Row[]

      return (
        <div class="tb-skin">
          <Spin spinning={props.loading}>
            <Table
              class="tb-table"
              dataSource={data}
              rowKey={rowKeyFn}
              columns={tableColumns.value}
              rowSelection={rowSelection.value}
              bordered={props.border}
              pagination={false}
              scroll={{ y: scrollY.value, x: 'max-content' }}
              onChange={handleChange}
              size="middle"
              showSorterTooltip={false}
              locale={{ emptyText: () => <Empty description={props.emptyText ?? '暂无数据'} /> }}
            />
          </Spin>
        </div>
      )
    }
  },
})
