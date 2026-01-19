import { VxeColumn, VxeTable } from 'vxe-table'
import type { VxeTableDefines, VxeTableInstance, VxeTablePropTypes } from 'vxe-table'
import { computed, defineComponent, ref, watch } from 'vue'
import type { TableColumnDef, TreeTableHandle, TreeTableProps } from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

type Row = Record<string, unknown>

type TreeRow = Row & {
  hasChildren?: boolean
  children?: TreeRow[]
}

function valueOf(row: Row, col: TableColumnDef<Row>): unknown {
  if (col.valueGetter) return col.valueGetter(row)
  return row[col.key]
}

function renderCell(row: Row, rowIndex: number, col: TableColumnDef<Row>) {
  try {
    const Cell = col.cell
    if (Cell) return <Cell row={row} rowIndex={rowIndex} />
    return <span class="tb-cell-text">{defaultCellText(valueOf(row, col))}</span>
  } catch (e) {
    console.error('[VxeTreeTable] cell render error', { columnKey: col.key, rowIndex, error: e })
    return <span style={{ color: 'var(--el-color-danger)' }}>RenderError</span>
  }
}

function renderColumn(col: TableColumnDef<Row>, treeNode: boolean) {
  const Header = col.headerCell
  const useFixedWidth = Boolean(col.fixed)
  return (
    <VxeColumn
      key={col.key}
      field={col.key}
      title={col.title}
      width={useFixedWidth ? col.width : undefined}
      minWidth={!useFixedWidth ? col.width : undefined}
      fixed={col.fixed}
      align={col.align}
      treeNode={treeNode ? true : undefined}
      showOverflow
      v-slots={{
        default: ({ row, rowIndex }: { row: Row; rowIndex: number }) =>
          renderCell(row, rowIndex, col),
        header: Header ? () => <Header /> : undefined,
      }}
    />
  )
}

function flattenRows(rows: Row[], out: Row[]) {
  for (const row of rows) {
    out.push(row)
    const children = (row as TreeRow).children
    if (children?.length) flattenRows(children as Row[], out)
  }
}

export const VxeTreeTable = defineComponent<TreeTableProps<Row>>({
  name: 'VxeTreeTableAdapter',
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
  setup(props, { expose }) {
    const tableRef = ref<VxeTableInstance<Row> | null>(null)
    const syncingSelection = ref(false)
    const expandToken = ref(0)

    const rowKeyField = computed(() => (typeof props.rowKey === 'string' ? props.rowKey : null))
    const rowKeyFn = (row: Row) => getRowKey(props.rowKey, row)

    const heightStyle = computed(() =>
      typeof props.height === 'number' ? `${props.height}px` : String(props.height),
    )

    const tableHeight = computed<VxeTablePropTypes.Height>(() =>
      typeof props.height === 'number' ? props.height : '100%',
    )

    const selectionEnabled = computed(() => !!props.selection && !!props.onUpdateSelectedRowKeys)

    const rowConfig = computed(() =>
      rowKeyField.value ? { useKey: true, keyField: rowKeyField.value } : undefined,
    )

    const roots = computed(() =>
      props.filterRow
        ? (props.roots as Row[]).filter((row) => props.filterRow?.(row))
        : (props.roots as Row[]),
    )

    const treeConfig = computed<VxeTablePropTypes.TreeConfig<Row>>(() => ({
      childrenField: 'children',
      hasChildField: 'hasChildren',
      lazy: true,
      showIcon: true,
      indent: 14,
      reserve: true,
      loadMethod: async ({ row }) => {
        const children = await props.loadChildren(row)
        return props.filterRow ? children.filter((child) => props.filterRow?.(child)) : children
      },
    }))

    function syncSelection(keys: string[]) {
      if (!selectionEnabled.value || !tableRef.value) return
      syncingSelection.value = true
      tableRef.value.clearCheckboxRow()
      if (rowKeyField.value) {
        tableRef.value.setCheckboxRowKey(keys, true)
      } else {
        const allRows: Row[] = []
        flattenRows(roots.value, allRows)
        const keySet = new Set(keys)
        const rows = allRows.filter((row) => keySet.has(rowKeyFn(row)))
        tableRef.value.setCheckboxRow(rows, true)
      }
      syncingSelection.value = false
    }

    function emitSelection() {
      if (!props.onUpdateSelectedRowKeys || syncingSelection.value) return
      const records = tableRef.value?.getCheckboxRecords?.() ?? []
      props.onUpdateSelectedRowKeys(records.map((row) => rowKeyFn(row as Row)))
    }

    function onCellClick(params: VxeTableDefines.CellClickEventParams<Row>) {
      props.onRowClick?.(params.row)
    }

    watch(
      () => [props.selectedRowKeys, props.roots],
      () => {
        if (!selectionEnabled.value) return
        syncSelection((props.selectedRowKeys as string[] | undefined) ?? [])
      },
      { deep: true },
    )

    async function expandTo(level: number) {
      const token = (expandToken.value += 1)
      const targetDepth = Math.max(0, level - 1)
      if (!tableRef.value) return
      await tableRef.value.clearTreeExpand()

      const expandBatch = async (rows: Row[]) => {
        const table = tableRef.value
        if (!table) return
        const batchSize = 6
        for (let i = 0; i < rows.length; i += batchSize) {
          if (token !== expandToken.value) return
          const batch = rows.slice(i, i + batchSize)
          await Promise.all(batch.map((row) => table.setTreeExpand(row, true)))
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
        }
      }

      const collectAtDepth = (rows: Row[], depth: number, out: Row[]) => {
        for (const row of rows) {
          if (depth === 0) {
            out.push(row)
            continue
          }
          const children = (row as TreeRow).children ?? []
          if (children.length) collectAtDepth(children as Row[], depth - 1, out)
        }
      }

      for (let depth = 0; depth < targetDepth; depth += 1) {
        if (token !== expandToken.value) return
        const rowsAtDepth: Row[] = []
        collectAtDepth(roots.value, depth, rowsAtDepth)
        const expandableRows = rowsAtDepth.filter((row) =>
          Boolean((row as TreeRow).hasChildren || (row as TreeRow).children?.length),
        )
        await expandBatch(expandableRows)
      }
    }

    function collapseAll() {
      expandToken.value += 1
      void tableRef.value?.clearTreeExpand?.()
    }

    expose({ expandTo, collapseAll } satisfies TreeTableHandle)

    return () => {
      const defs = props.columns as TableColumnDef<Row>[]

      return (
        <div class="tb-skin" style={{ height: heightStyle.value }}>
          <VxeTable
            ref={tableRef}
            data={roots.value}
            height={tableHeight.value}
            fit
            border={props.border ? 'inner' : false}
            loading={props.loading}
            scrollY={{ enabled: true, gt: 50 }}
            scrollX={{ enabled: true, gt: 20 }}
            rowConfig={rowConfig.value}
            treeConfig={treeConfig.value}
            columnConfig={{ resizable: false }}
            showOverflow
            emptyText={props.emptyText ?? '暂无数据'}
            checkboxConfig={selectionEnabled.value ? { reserve: true } : undefined}
            onCheckboxChange={emitSelection}
            onCheckboxAll={emitSelection}
            onCellClick={props.onRowClick ? onCellClick : undefined}
          >
            {selectionEnabled.value ? <VxeColumn type="checkbox" width={50} fixed="left" /> : null}
            {defs.map((col, index) => renderColumn(col, index === 0))}
          </VxeTable>
        </div>
      )
    }
  },
})
