import { Button, DatePicker, Empty, Input, InputNumber, Space, Spin, Table } from 'ant-design-vue'
import type { Dayjs } from 'dayjs'
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

function toTimeValue(value: unknown): number | null {
  if (!value) return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : t
  }
  const t = new Date(String(value)).getTime()
  return Number.isNaN(t) ? null : t
}

function buildColumns(
  columns: TableColumnDef<Row>[],
  sort: TableSortRule[] | undefined,
  spanMethod?: DataTableProps<Row>['spanMethod'],
): ColumnType<Row>[] {
  const currentSort = toAntSort(sort)
  return columns.map((col) => {
    const Header = col.headerCell
    const filter = col.filter
    const filterProps: Partial<ColumnType<Row>> = {}

    if (filter?.type === 'select') {
      filterProps.filters = filter.options.map((option) => ({
        text: option.label,
        value: option.value,
      }))
      filterProps.filterMultiple = false
      filterProps.onFilter = (value, record) =>
        String((record as Record<string, unknown>)[col.key] ?? '') === String(value ?? '')
    }

    if (filter?.type === 'text') {
      filterProps.filterDropdown = ({
        selectedKeys,
        setSelectedKeys,
        confirm,
        clearFilters,
      }: {
        selectedKeys: (string | number)[]
        setSelectedKeys: (keys: (string | number)[]) => void
        confirm: (opts?: { closeDropdown?: boolean }) => void
        clearFilters?: () => void
      }) => (
        <div class="tb-ant-filter">
          <Input
            placeholder={filter.placeholder ?? '输入关键词'}
            value={selectedKeys[0] as string | undefined}
            onChange={(e) => {
              const next = e.target.value
              setSelectedKeys(next ? [next] : [])
            }}
            onPressEnter={() => confirm()}
          />
          <Space class="tb-ant-filter-actions" size={6}>
            <Button type="primary" size="small" onClick={() => confirm()}>
              筛选
            </Button>
            <Button
              size="small"
              onClick={() => {
                clearFilters?.()
                confirm({ closeDropdown: true })
              }}
            >
              重置
            </Button>
          </Space>
        </div>
      )
      filterProps.onFilter = (value, record) =>
        String((record as Record<string, unknown>)[col.key] ?? '')
          .toLowerCase()
          .includes(String(value ?? '').toLowerCase())
    }

    if (filter?.type === 'date') {
      filterProps.filterDropdown = ({
        selectedKeys,
        setSelectedKeys,
        confirm,
        clearFilters,
      }: {
        selectedKeys: unknown[]
        setSelectedKeys: (keys: unknown[]) => void
        confirm: (opts?: { closeDropdown?: boolean }) => void
        clearFilters?: () => void
      }) => (
        <div class="tb-ant-filter">
          <DatePicker.RangePicker
            value={Array.isArray(selectedKeys[0]) ? (selectedKeys[0] as [Dayjs, Dayjs]) : null}
            onChange={(next) => setSelectedKeys(next ? [next] : [])}
            onOpenChange={(open) => {
              if (!open) confirm()
            }}
          />
          <Space class="tb-ant-filter-actions" size={6}>
            <Button type="primary" size="small" onClick={() => confirm()}>
              筛选
            </Button>
            <Button
              size="small"
              onClick={() => {
                clearFilters?.()
                confirm({ closeDropdown: true })
              }}
            >
              重置
            </Button>
          </Space>
        </div>
      )
      filterProps.onFilter = (value, record) => {
        const range = Array.isArray(value) ? (value as Array<{ valueOf: () => number }>) : []
        const start = range[0]?.valueOf?.()
        const end = range[1]?.valueOf?.()
        if (!start || !end) return true
        const cell = toTimeValue((record as Record<string, unknown>)[col.key])
        if (!cell) return false
        return cell >= start && cell <= end
      }
    }

    if (filter?.type === 'custom' && filter.key === 'riskMin') {
      filterProps.filterDropdown = ({
        selectedKeys,
        setSelectedKeys,
        confirm,
        clearFilters,
      }: {
        selectedKeys: unknown[]
        setSelectedKeys: (keys: unknown[]) => void
        confirm: (opts?: { closeDropdown?: boolean }) => void
        clearFilters?: () => void
      }) => (
        <div class="tb-ant-filter">
          <InputNumber
            min={1}
            max={5}
            value={typeof selectedKeys[0] === 'number' ? (selectedKeys[0] as number) : undefined}
            placeholder={filter.placeholder ?? '最低风险等级'}
            onChange={(next) => setSelectedKeys(next != null ? [next] : [])}
          />
          <Space class="tb-ant-filter-actions" size={6}>
            <Button type="primary" size="small" onClick={() => confirm()}>
              筛选
            </Button>
            <Button
              size="small"
              onClick={() => {
                clearFilters?.()
                confirm({ closeDropdown: true })
              }}
            >
              重置
            </Button>
          </Space>
        </div>
      )
      filterProps.onFilter = (value, record) => {
        const min = Number(value)
        if (!Number.isFinite(min)) return true
        return Number((record as Record<string, unknown>)[col.key]) >= min
      }
    }
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
      ...filterProps,
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
