import { VxeColgroup, VxeColumn, VxeTable } from 'vxe-table'
import type { VxeTableInstance, VxeTableDefines, VxeTablePropTypes } from 'vxe-table'
import { computed, defineComponent, ref, watch } from 'vue'
import type {
  DataTableProps,
  TableColumnDef,
  TableHeaderGroup,
  TableSortRule,
} from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

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

function renderColumn<RowType>(col: TableColumnDef<RowType>) {
  const Header = col.headerCell
  return (
    <VxeColumn
      key={col.key}
      field={col.key}
      title={col.title}
      width={col.width}
      fixed={col.fixed}
      align={col.align}
      sortable={col.sortable}
      showOverflow
      v-slots={{
        default: ({ row, rowIndex }: { row: RowType; rowIndex: number }) =>
          renderCell(row, rowIndex, col),
        header: Header ? () => <Header /> : undefined,
      }}
    />
  )
}

function renderGroupedColumns<RowType>(groups: TableHeaderGroup<RowType>[]) {
  return groups.map((g) => (
    <VxeColgroup key={g.title} title={g.title}>
      {g.columns.map((col) => renderColumn(col))}
    </VxeColgroup>
  ))
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
    const tableRef = ref<VxeTableInstance<Row> | null>(null)
    const syncingSelection = ref(false)

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
      rowKeyField.value ? { useKey: true, keyField: rowKeyField.value } : undefined,
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

      return (
        <div class="tb-skin" style={{ height: heightStyle.value }}>
          <VxeTable
            ref={tableRef}
            data={props.rows as Row[]}
            height={tableHeight.value}
            border={props.border ? 'inner' : false}
            loading={props.loading}
            scrollY={{ enabled: true, gt: 50 }}
            scrollX={{ enabled: true, gt: 20 }}
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
          >
            <VxeColumn type="seq" width={50} fixed="left" />
            {selectionEnabled.value ? <VxeColumn type="checkbox" width={50} fixed="left" /> : null}
            {groups?.length ? renderGroupedColumns(groups) : null}
            {leafColumns.map((col) => renderColumn(col))}
          </VxeTable>
        </div>
      )
    }
  },
})
