import { VxeGrid } from 'vxe-table'
import type {
  VxeGridInstance,
  VxeGridPropTypes,
  VxeTableDefines,
  VxeTablePropTypes,
} from 'vxe-table'
import { computed, defineComponent, ref, watch } from 'vue'
import type {
  DataTableProps,
  TableColumnDef,
  TableHeaderGroup,
  TableSortRule,
} from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'
import { useBenchmarkStore } from '../../stores/benchmark'

type Row = Record<string, unknown>

function renderCell<RowType>(row: RowType, rowIndex: number, col: TableColumnDef<RowType>) {
  try {
    const Cell = col.cell
    if (Cell) return <Cell row={row} rowIndex={rowIndex} />
    const raw = row as Record<string, unknown>
    return (
      <span class="tb-cell-text">{defaultCellText(col.valueGetter?.(row) ?? raw[col.key])}</span>
    )
  } catch (e) {
    console.error('[VxeDataTable] cell render error', { columnKey: col.key, rowIndex, error: e })
    return <span style={{ color: 'var(--el-color-danger)' }}>RenderError</span>
  }
}

type RenderColumnOptions = {
  disableFixed?: boolean
  forceWidth?: boolean
}

type GridColumn<RowType> = VxeGridPropTypes.Column<RowType>

function renderColumn<RowType>(
  col: TableColumnDef<RowType>,
  options: RenderColumnOptions = {},
): GridColumn<RowType> {
  const Header = col.headerCell
  const fixed = options.disableFixed ? undefined : col.fixed
  const useFixedWidth = options.forceWidth ?? Boolean(fixed)
  const filter = col.filter
  const filterProps =
    filter?.type === 'select'
      ? {
          filters: filter.options.map((option) => ({
            label: option.label,
            value: option.value,
          })),
          filterMultiple: false,
        }
      : filter?.type === 'text'
        ? {
            filters: [{ data: '' }],
            filterRender: {
              name: 'VxeInput',
              props: { clearable: true, placeholder: filter.placeholder ?? '输入关键词' },
            },
            filterMethod: ({ option, row }: { option: { data?: unknown }; row: RowType }) => {
              const keyword = String(option.data ?? '')
                .trim()
                .toLowerCase()
              if (!keyword) return true
              const raw = (row as Record<string, unknown>)[col.key]
              return String(raw ?? '')
                .toLowerCase()
                .includes(keyword)
            },
          }
        : filter?.type === 'date'
          ? {
              filters: [{ data: [] }],
              filterRender: {
                name: 'VxeDatePicker',
                props: { type: 'daterange', transfer: true },
              },
              filterMethod: ({ option, row }: { option: { data?: unknown }; row: RowType }) => {
                const range = Array.isArray(option.data) ? option.data : []
                const start = range[0] ? new Date(String(range[0])).getTime() : null
                const end = range[1] ? new Date(String(range[1])).getTime() : null
                if (!start || !end) return true
                const raw = (row as Record<string, unknown>)[col.key]
                const cell = raw ? new Date(String(raw)).getTime() : NaN
                if (Number.isNaN(cell)) return false
                return cell >= start && cell <= end
              },
            }
          : filter?.type === 'custom' && filter.key === 'riskMin'
            ? {
                filters: [{ data: null }],
                filterRender: {
                  name: 'VxeNumberInput',
                  props: { min: 1, max: 5, controls: true },
                },
                filterMethod: ({ option, row }: { option: { data?: unknown }; row: RowType }) => {
                  const min = Number(option.data)
                  if (!Number.isFinite(min)) return true
                  const raw = (row as Record<string, unknown>)[col.key]
                  return Number(raw) >= min
                },
              }
            : {}
  const slots = {
    default: ({ row, rowIndex }: { row: RowType; rowIndex: number }) =>
      renderCell(row, rowIndex, col),
    header: Header ? () => <Header /> : undefined,
  }

  return {
    field: col.key,
    title: col.title,
    width: useFixedWidth ? col.width : undefined,
    minWidth: !useFixedWidth ? col.width : undefined,
    fixed,
    align: col.align,
    sortable: col.sortable,
    showOverflow: true,
    slots,
    ...filterProps,
  }
}

function resolveGroupFixed<RowType>(group: TableHeaderGroup<RowType>) {
  const fixedValues = new Set(group.columns.map((col) => col.fixed).filter(Boolean))
  return fixedValues.size === 1
    ? (fixedValues.values().next().value as 'left' | 'right')
    : undefined
}

function renderGroupedColumns<RowType>(
  groups: TableHeaderGroup<RowType>[],
  allowFixed: boolean,
): GridColumn<RowType>[] {
  return groups.map((g) => {
    const groupFixed = allowFixed ? resolveGroupFixed(g) : undefined
    const hasAnyFixed = allowFixed && g.columns.some((col) => Boolean(col.fixed))
    return {
      title: g.title,
      fixed: groupFixed,
      children: g.columns.map((col) =>
        renderColumn(col, {
          disableFixed: !allowFixed || Boolean(groupFixed || hasAnyFixed),
          forceWidth: Boolean(groupFixed || (allowFixed && col.fixed)),
        }),
      ),
    }
  })
}

export const VxeDataTable = defineComponent<DataTableProps<Row>>({
  name: 'VxeDataTableAdapter',
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
    const tableRef = ref<VxeGridInstance<Row> | null>(null)
    const syncingSelection = ref(false)
    const store = useBenchmarkStore()

    const heightStyle = computed(() =>
      typeof props.height === 'number' ? `${props.height}px` : String(props.height),
    )

    const tableHeight = computed<VxeTablePropTypes.Height>(() =>
      typeof props.height === 'number' ? props.height : '100%',
    )

    const rowKeyField = computed(() => (typeof props.rowKey === 'string' ? props.rowKey : null))
    const rowKeyFn = (row: Row) => getRowKey(props.rowKey, row)

    const selectionEnabled = computed(() => !!props.selection && !!props.onUpdateSelectedRowKeys)

    const rowConfig = computed(() =>
      rowKeyField.value
        ? { useKey: true, keyField: rowKeyField.value, isHover: true }
        : { isHover: true },
    )

    const sortConfig = computed(() =>
      props.onUpdateSort ? ({ trigger: 'cell', remote: true } as const) : undefined,
    )

    const spanMethod = computed<VxeTablePropTypes.SpanMethod<Row> | undefined>(() => {
      if (!props.spanMethod) return undefined
      return (params) => {
        const columnKey = params.column?.field
        if (!columnKey) return { rowspan: 1, colspan: 1 }
        const rowIndex =
          (params as { rowIndex?: number }).rowIndex ??
          (params as { $rowIndex?: number }).$rowIndex ??
          (params as { _rowIndex?: number })._rowIndex ??
          0
        return props.spanMethod?.({ row: params.row, rowIndex, columnKey: String(columnKey) })
      }
    })

    function syncSelection(keys: string[]) {
      if (!selectionEnabled.value || !tableRef.value) return
      syncingSelection.value = true
      tableRef.value.clearCheckboxRow()
      if (rowKeyField.value) {
        tableRef.value.setCheckboxRowKey(keys, true)
      } else {
        const data = props.rows as Row[]
        const keySet = new Set(keys)
        const rows = data.filter((row) => keySet.has(rowKeyFn(row)))
        tableRef.value.setCheckboxRow(rows, true)
      }
      syncingSelection.value = false
    }

    function syncSort(sort: TableSortRule[] | undefined) {
      if (!props.onUpdateSort || !tableRef.value) return
      if (!sort?.length) {
        tableRef.value.clearSort()
        return
      }
      const rule = sort[0]!
      tableRef.value.setSort({ field: rule.key, order: rule.order })
    }

    function onSortChange(params: VxeTableDefines.SortChangeEventParams<Row>) {
      if (!props.onUpdateSort) return
      const order = params.order
      const field = params.field
      if (!order || !field) {
        props.onUpdateSort([])
        return
      }
      props.onUpdateSort([{ key: String(field), order }])
    }

    function emitSelection() {
      if (!props.onUpdateSelectedRowKeys || syncingSelection.value) return
      const records = tableRef.value?.getCheckboxRecords?.() ?? []
      props.onUpdateSelectedRowKeys(records.map((row) => rowKeyFn(row as Row)))
    }

    watch(
      () => [props.selectedRowKeys, props.rows],
      () => {
        if (!selectionEnabled.value) return
        syncSelection((props.selectedRowKeys as string[] | undefined) ?? [])
      },
      { deep: true },
    )

    watch(
      () => props.sort,
      (next) => syncSort(next as TableSortRule[] | undefined),
      { deep: true },
    )

    return () => {
      const defs = props.columns as TableColumnDef<Row>[]
      const groups = props.headerGroups as TableHeaderGroup<Row>[] | undefined
      const groupedKeys = new Set(groups?.flatMap((g) => g.columns.map((c) => c.key)) ?? [])
      const leafColumns = defs.filter((col) => !groupedKeys.has(col.key))
      const hasGroupedHeader = Boolean(groups?.length)
      const hasFixedColumns = defs.some((col) => Boolean(col.fixed))
      const allowFixed = store.toggles.fixedCols
      const enableVirtualY = store.toggles.rowVirtual
      const enableVirtualX =
        store.toggles.colVirtual && !(allowFixed && hasGroupedHeader && hasFixedColumns)
      const gridColumns: GridColumn<Row>[] = []

      gridColumns.push({
        type: 'seq',
        width: 50,
        fixed: allowFixed ? 'left' : undefined,
      })
      if (selectionEnabled.value) {
        gridColumns.push({
          type: 'checkbox',
          width: 50,
          fixed: allowFixed ? 'left' : undefined,
        })
      }
      if (groups?.length) {
        gridColumns.push(...renderGroupedColumns(groups, allowFixed))
      }
      gridColumns.push(
        ...leafColumns.map((col) => renderColumn(col, { disableFixed: !allowFixed })),
      )

      return (
        <div class="tb-skin" style={{ height: heightStyle.value }}>
          <VxeGrid
            ref={tableRef}
            data={props.rows as Row[]}
            columns={gridColumns}
            height={tableHeight.value}
            border={props.border ? 'full' : false}
            loading={props.loading}
            virtualYConfig={enableVirtualY ? { enabled: true, gt: 50 } : { enabled: false }}
            virtualXConfig={enableVirtualX ? { enabled: true, gt: 20 } : { enabled: false }}
            rowConfig={rowConfig.value}
            columnConfig={{ resizable: false }}
            showOverflow
            emptyText={props.emptyText ?? '暂无数据'}
            sortConfig={sortConfig.value}
            checkboxConfig={selectionEnabled.value ? { reserve: true } : undefined}
            spanMethod={spanMethod.value}
            onSortChange={onSortChange}
            onCheckboxChange={emitSelection}
            onCheckboxAll={emitSelection}
            stripe={true}
          />
        </div>
      )
    }
  },
})
