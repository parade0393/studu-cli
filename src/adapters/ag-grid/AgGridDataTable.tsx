import { AgGridVue } from 'ag-grid-vue3'
import type {
  ColDef,
  ColGroupDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
  SortChangedEvent,
  SortDirection,
} from 'ag-grid-community'
import { computed, defineComponent, h, ref, watch, type PropType } from 'vue'
import type {
  DataTableProps,
  TableColumnDef,
  TableHeaderGroup,
  TableSortRule,
} from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

type Row = Record<string, unknown>

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 40

const AgCellRenderer = defineComponent({
  props: {
    params: {
      type: Object as PropType<{ data: Row; rowIndex: number; value: unknown }>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const params = props.params as { data: Row; rowIndex: number; value: unknown }
      const cell =
        (
          props.params as {
            colDef?: { cellRendererParams?: { cell?: TableColumnDef<Row>['cell'] } }
          }
        ).colDef?.cellRendererParams?.cell ?? null

      if (cell)
        return h(cell as unknown as Record<string, never>, {
          row: params.data,
          rowIndex: params.rowIndex,
        })
      const text = defaultCellText(params.value)
      return h(
        'span',
        { class: 'tb-cell-text' },
        typeof text === 'string' ? text : String(text ?? ''),
      )
    }
  },
})

const AgHeaderRenderer = defineComponent({
  props: {
    params: {
      type: Object as PropType<{
        displayName?: string
        headerComponentParams?: { headerCell?: () => unknown }
      }>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const Header = props.params.headerComponentParams?.headerCell
      if (Header) return h(Header as unknown as Record<string, never>)
      return h('span', props.params.displayName ?? '')
    }
  },
})

function toSortState(
  sort: TableSortRule[] | undefined,
): { key: string; order: 'asc' | 'desc' } | null {
  const rule = sort?.[0]
  if (!rule) return null
  return { key: rule.key, order: rule.order }
}

function buildColDef(
  col: TableColumnDef<Row>,
  sortState: { key: string; order: 'asc' | 'desc' } | null,
): ColDef<Row> {
  const Header = col.headerCell
  return {
    colId: col.key,
    field: col.key,
    headerName: col.title,
    width: col.width,
    pinned: col.fixed,
    sortable: !!col.sortable,
    sort: sortState?.key === col.key ? (sortState.order === 'asc' ? 'asc' : 'desc') : undefined,
    valueGetter: col.valueGetter ? (p) => col.valueGetter?.(p.data as Row) : undefined,
    cellRenderer: col.cell ? AgCellRenderer : undefined,
    cellRendererParams: col.cell ? { cell: col.cell } : undefined,
    headerComponent: Header ? AgHeaderRenderer : undefined,
    headerComponentParams: Header ? { headerCell: Header } : undefined,
  }
}

function buildGroupedDefs(
  groups: TableHeaderGroup<Row>[],
  sortState: { key: string; order: 'asc' | 'desc' } | null,
): ColGroupDef<Row>[] {
  return groups.map((group) => ({
    headerName: group.title,
    children: group.columns.map((col) => buildColDef(col, sortState)),
  }))
}

function fromAgSort(sortModel: { colId: string; sort: SortDirection }[]): TableSortRule[] {
  return sortModel
    .filter((model) => model.sort === 'asc' || model.sort === 'desc')
    .map((model) => ({ key: model.colId, order: model.sort as 'asc' | 'desc' }))
}

export const AgGridDataTable = defineComponent<DataTableProps<Row>>({
  name: 'AgGridDataTableAdapter',
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
    const gridApi = ref<GridApi | null>(null)
    const syncingSelection = ref(false)

    const rowKeyFn = (row: Row) => getRowKey(props.rowKey, row)

    const heightStyle = computed(() =>
      typeof props.height === 'number' ? `${props.height}px` : String(props.height),
    )

    const sortState = computed(() => toSortState(props.sort as TableSortRule[] | undefined))

    const columnDefs = computed<(ColDef<Row> | ColGroupDef<Row>)[]>(() => {
      const defs = props.columns as TableColumnDef<Row>[]
      const groups = props.headerGroups as TableHeaderGroup<Row>[] | undefined

      const selectionEnabled = !!props.selection && !!props.onUpdateSelectedRowKeys

      const selectionColumn: ColDef<Row> | null = selectionEnabled
        ? {
            colId: '_select',
            headerName: '',
            width: 50,
            pinned: 'left',
            checkboxSelection: true,
            headerCheckboxSelection: true,
            sortable: false,
            resizable: false,
          }
        : null

      const indexColumn: ColDef<Row> = {
        colId: '_index',
        headerName: '#',
        width: 50,
        pinned: 'left',
        sortable: false,
        resizable: false,
        valueGetter: (p) => (p.node?.rowIndex != null ? p.node.rowIndex + 1 : ''),
      }

      const baseDefs = groups?.length ? buildGroupedDefs(groups, sortState.value) : null
      const groupKeys = new Set(groups?.flatMap((g) => g.columns.map((c) => c.key)) ?? [])
      const flatDefs = defs
        .filter((c) => !groupKeys.has(c.key))
        .map((c) => buildColDef(c, sortState.value))

      const bodyDefs = baseDefs ? [...baseDefs, ...flatDefs] : flatDefs
      const prefix = selectionColumn ? [selectionColumn, indexColumn] : [indexColumn]

      return [...prefix, ...bodyDefs]
    })

    function syncSelection(keys: string[]) {
      if (!gridApi.value) return
      syncingSelection.value = true
      const keySet = new Set(keys)
      gridApi.value.forEachNode((node) => {
        if (!node.data) return
        const key = rowKeyFn(node.data as Row)
        node.setSelected(keySet.has(key))
      })
      syncingSelection.value = false
    }

    function syncSort(sort: TableSortRule[] | undefined) {
      if (!gridApi.value) return
      const state =
        sort?.map((rule) => ({
          colId: rule.key,
          sort: (rule.order === 'asc' ? 'asc' : 'desc') as SortDirection,
        })) ?? []
      gridApi.value.applyColumnState({
        state,
        defaultState: { sort: null },
      })
    }

    function updateOverlay() {
      if (!gridApi.value) return
      if (props.loading) {
        gridApi.value.showLoadingOverlay()
        return
      }
      if ((props.rows as Row[]).length === 0) {
        gridApi.value.showNoRowsOverlay()
      } else {
        gridApi.value.hideOverlay()
      }
    }

    function onGridReady(event: GridReadyEvent) {
      gridApi.value = event.api
      syncSelection((props.selectedRowKeys as string[] | undefined) ?? [])
      syncSort(props.sort as TableSortRule[] | undefined)
      updateOverlay()
    }

    function onSelectionChanged(event: SelectionChangedEvent) {
      if (!props.onUpdateSelectedRowKeys || syncingSelection.value) return
      const keys = event.api
        .getSelectedNodes()
        .map((node) => (node.data ? rowKeyFn(node.data as Row) : ''))
        .filter(Boolean)
      props.onUpdateSelectedRowKeys(keys)
    }

    function onSortChanged(event: SortChangedEvent) {
      if (!props.onUpdateSort) return
      const state = event.api.getColumnState()
      const model = state
        .filter((item) => item.sort)
        .map((item) => ({ colId: item.colId ?? '', sort: item.sort as SortDirection }))
        .filter((item) => item.colId)
      props.onUpdateSort(fromAgSort(model))
    }

    watch(
      () => [props.selectedRowKeys, props.rows],
      () => {
        if (!props.selection || !props.onUpdateSelectedRowKeys) return
        syncSelection((props.selectedRowKeys as string[] | undefined) ?? [])
      },
      { deep: true },
    )

    watch(
      () => props.sort,
      (next) => syncSort(next as TableSortRule[] | undefined),
      { deep: true },
    )

    watch(
      () => [props.loading, props.rows],
      () => updateOverlay(),
      { deep: true },
    )

    return () => {
      const selectionEnabled = !!props.selection && !!props.onUpdateSelectedRowKeys

      const gridOptions = {
        onGridReady,
        onSelectionChanged,
        onSortChanged,
      }

      return (
        <div
          class={['tb-skin', 'ag-theme-quartz', props.border ? 'tb-bordered' : null]}
          style={{ height: heightStyle.value }}
        >
          <AgGridVue
            class="tb-ag-grid"
            style={{ height: '100%', width: '100%' }}
            gridOptions={gridOptions}
            columnDefs={columnDefs.value}
            rowData={props.rows as Row[]}
            getRowId={(p) => rowKeyFn(p.data as Row)}
            rowSelection={selectionEnabled ? 'multiple' : undefined}
            suppressRowClickSelection={selectionEnabled}
            suppressMultiSort
            rowHeight={ROW_HEIGHT}
            headerHeight={HEADER_HEIGHT}
            overlayNoRowsTemplate={`<span>${props.emptyText ?? '暂无数据'}</span>`}
            overlayLoadingTemplate={'<span>Loading...</span>'}
          />
        </div>
      )
    }
  },
})
