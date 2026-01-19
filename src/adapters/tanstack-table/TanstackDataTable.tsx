import {
  FlexRender,
  getCoreRowModel,
  useVueTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useElementSize } from '@vueuse/core'
import { computed, defineComponent, h, ref } from 'vue'
import type {
  DataTableProps,
  TableAlign,
  TableColumnDef,
  TableHeaderGroup,
  TableSortRule,
} from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

type Row = Record<string, unknown>

type ColumnMeta = {
  width?: number
  align?: TableAlign
  columnKey?: string
  skipSpan?: boolean
  fixed?: 'left' | 'right'
}

type Updater<T> = T | ((old: T) => T)

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(prev) : updater
}

function valueOf(row: Row, col: TableColumnDef<Row>): unknown {
  if (col.valueGetter) return col.valueGetter(row)
  return row[col.key]
}

function renderCell(row: Row, rowIndex: number, col: TableColumnDef<Row>) {
  try {
    const Cell = col.cell
    if (Cell) return <Cell row={row} rowIndex={rowIndex} />
    return defaultCellText(valueOf(row, col))
  } catch (e) {
    console.error('[TanstackDataTable] cell render error', {
      columnKey: col.key,
      rowIndex,
      error: e,
    })
    return <span style={{ color: 'var(--el-color-danger)' }}>RenderError</span>
  }
}

function toSortingState(sort: TableSortRule[] | undefined): SortingState {
  if (!sort?.length) return []
  return sort.map((rule) => ({ id: rule.key, desc: rule.order === 'desc' }))
}

function fromSortingState(sorting: SortingState): TableSortRule[] {
  return sorting.map((rule) => ({ key: rule.id, order: rule.desc ? 'desc' : 'asc' }))
}

function buildLeafColumn(col: TableColumnDef<Row>): ColumnDef<Row> {
  const Header = col.headerCell
  return {
    id: col.key,
    accessorKey: col.key,
    header: Header ? () => <Header /> : col.title,
    cell: (info) => renderCell(info.row.original, info.row.index, col),
    enableSorting: !!col.sortable,
    meta: {
      width: col.width,
      align: col.align,
      columnKey: col.key,
      fixed: col.fixed,
    } satisfies ColumnMeta,
  }
}

function buildGroupedColumns(groups: TableHeaderGroup<Row>[]): ColumnDef<Row>[] {
  return groups.map((g) => ({
    id: `group_${g.title}`,
    header: g.title,
    columns: g.columns.map(buildLeafColumn),
  }))
}

function collectLeafDefs(
  defs: TableColumnDef<Row>[],
  groups?: TableHeaderGroup<Row>[],
): TableColumnDef<Row>[] {
  if (groups?.length) {
    return groups.flatMap((g) => g.columns)
  }
  return defs
}

function toColumnPinning(
  defs: TableColumnDef<Row>[],
  groups: TableHeaderGroup<Row>[] | undefined,
  selectionEnabled: boolean,
): { left: string[]; right: string[] } {
  const leafDefs = collectLeafDefs(defs, groups)
  const left: string[] = ['_index']
  if (selectionEnabled) left.push('_select')
  const right: string[] = []

  leafDefs.forEach((col) => {
    if (col.fixed === 'left') left.push(col.key)
    if (col.fixed === 'right') right.push(col.key)
  })

  return { left, right }
}

function asRowSelection(keys: string[] | undefined): RowSelectionState {
  if (!keys?.length) return {}
  return keys.reduce<RowSelectionState>((acc, key) => {
    acc[key] = true
    return acc
  }, {})
}

export const TanstackDataTable = defineComponent<DataTableProps<Row>>({
  name: 'TanstackDataTableAdapter',
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

    const sorting = computed<SortingState>(() => toSortingState(props.sort as TableSortRule[]))
    const rowSelection = computed<RowSelectionState>(() =>
      asRowSelection(props.selectedRowKeys as string[] | undefined),
    )

    const scrollRef = ref<HTMLElement | null>(null)
    const theadRef = ref<HTMLElement | null>(null)
    const rowHeight = 44

    // 动态获取表头高度，支持分组表头
    const { height: theadHeight } = useElementSize(theadRef)

    const columnPinning = computed(() => {
      const defs = props.columns as TableColumnDef<Row>[]
      const groups = props.headerGroups as TableHeaderGroup<Row>[] | undefined
      const selectionEnabled = !!props.selection && !!props.onUpdateSelectedRowKeys
      return toColumnPinning(defs, groups, selectionEnabled)
    })

    const columnDefs = computed<ColumnDef<Row>[]>(() => {
      const defs = props.columns as TableColumnDef<Row>[]
      const groups = props.headerGroups as TableHeaderGroup<Row>[] | undefined

      const selectionEnabled = !!props.selection && !!props.onUpdateSelectedRowKeys

      const indexColumn: ColumnDef<Row> = {
        id: '_index',
        header: '#',
        cell: (info) => info.row.index + 1,
        enableSorting: false,
        meta: {
          width: 50,
          align: 'center',
          skipSpan: true,
          fixed: 'left',
        } satisfies ColumnMeta,
      }

      const selectionColumn: ColumnDef<Row> | null = selectionEnabled
        ? {
            id: '_select',
            header: (ctx) => (
              <input
                type="checkbox"
                checked={ctx.table.getIsAllRowsSelected()}
                ref={(el) => {
                  if (!el) return
                  const input = el as HTMLInputElement
                  input.indeterminate = ctx.table.getIsSomeRowsSelected()
                }}
                onChange={ctx.table.getToggleAllRowsSelectedHandler()}
              />
            ),
            cell: (ctx) => (
              <input
                type="checkbox"
                checked={ctx.row.getIsSelected()}
                disabled={!ctx.row.getCanSelect()}
                onChange={ctx.row.getToggleSelectedHandler()}
              />
            ),
            enableSorting: false,
            meta: {
              width: 46,
              align: 'center',
              skipSpan: true,
              fixed: 'left',
            } satisfies ColumnMeta,
          }
        : null

      const baseColumns = groups?.length ? buildGroupedColumns(groups) : defs.map(buildLeafColumn)

      return selectionColumn
        ? [indexColumn, selectionColumn, ...baseColumns]
        : [indexColumn, ...baseColumns]
    })

    const table = useVueTable({
      get data() {
        return props.rows as Row[]
      },
      get columns() {
        return columnDefs.value
      },
      getRowId: (row) => rowKeyFn(row),
      getCoreRowModel: getCoreRowModel(),
      manualSorting: true,
      enableColumnPinning: true,
      state: {
        get sorting() {
          return sorting.value
        },
        get rowSelection() {
          return rowSelection.value
        },
        get columnPinning() {
          return columnPinning.value
        },
      },
      onSortingChange: (updater) => {
        if (!props.onUpdateSort) return
        const next = resolveUpdater(updater, sorting.value)
        props.onUpdateSort(fromSortingState(next))
      },
      onRowSelectionChange: (updater) => {
        if (!props.onUpdateSelectedRowKeys) return
        const next = resolveUpdater(updater, rowSelection.value)
        props.onUpdateSelectedRowKeys(Object.keys(next).filter((key) => next[key]))
      },
      enableRowSelection: !!props.selection,
    })

    const rowVirtualizer = useVirtualizer(
      computed(() => ({
        count: (props.rows as Row[]).length,
        getScrollElement: () => scrollRef.value,
        estimateSize: () => rowHeight,
        overscan: 8,
        // 不使用 paddingStart，因为 sticky header 不占据文档流空间
        // scrollPaddingStart 用于滚动时的偏移计算
        scrollPaddingStart: theadHeight.value || 0,
      })),
    )

    const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
    const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

    const stickyMap = computed(() => {
      const leftColumns = table.getLeftVisibleLeafColumns()
      const rightColumns = table.getRightVisibleLeafColumns()
      const map = new Map<string, { side: 'left' | 'right'; offset: number }>()
      let offset = 0
      leftColumns.forEach((column) => {
        const meta = column.columnDef.meta as ColumnMeta | undefined
        const width = meta?.width ?? 0
        map.set(column.id, { side: 'left', offset })
        offset += width
      })
      offset = 0
      for (let i = rightColumns.length - 1; i >= 0; i -= 1) {
        const column = rightColumns[i]!
        const meta = column.columnDef.meta as ColumnMeta | undefined
        const width = meta?.width ?? 0
        map.set(column.id, { side: 'right', offset })
        offset += width
      }

      return map
    })

    const tableWidth = computed(() => {
      const columns = table.getVisibleLeafColumns()
      return columns.reduce((sum, column) => {
        const meta = column.columnDef.meta as ColumnMeta | undefined
        const width = meta?.width ?? 120
        return sum + width
      }, 0)
    })

    const heightStyle = computed(() =>
      typeof props.height === 'number' ? `${props.height}px` : String(props.height),
    )

    return () => {
      const data = props.rows as Row[]
      const empty = !data.length
      const rowModel = table.getRowModel().rows

      return (
        <div class={['tb-skin', props.border ? 'tb-bordered' : null]}>
          <div class="tb-table-shell">
            <div class="tb-table-scroll" ref={scrollRef} style={{ height: heightStyle.value }}>
              <table
                class="tb-table tb-table--tanstack"
                style={{
                  height: `${totalSize.value}px`,
                  width: `${tableWidth.value}px`,
                  minWidth: '100%',
                }}
              >
                <thead ref={theadRef}>
                  {table.getCenterHeaderGroups().map((group, index) => {
                    const leftGroup = table.getLeftHeaderGroups()[index]
                    const rightGroup = table.getRightHeaderGroups()[index]

                    return (
                      <tr key={group.id}>
                        {(leftGroup?.headers ?? []).map((header) => {
                          const meta = header.column.columnDef.meta as ColumnMeta | undefined
                          const width = meta?.width ? `${meta.width}px` : undefined
                          const align = meta?.align
                          const canSort = header.column.getCanSort()
                          const sort = header.column.getIsSorted()
                          const sticky = stickyMap.value.get(header.column.id)

                          return (
                            <th
                              key={header.id}
                              colspan={header.colSpan}
                              style={{
                                width,
                                textAlign: align,
                                position: sticky ? 'sticky' : undefined,
                                left: sticky?.side === 'left' ? `${sticky.offset}px` : undefined,
                                right: sticky?.side === 'right' ? `${sticky.offset}px` : undefined,
                              }}
                              class={[
                                sticky ? `tb-sticky tb-sticky--${sticky.side}` : null,
                                canSort ? 'tb-sortable' : null,
                              ]}
                            >
                              {header.isPlaceholder ? null : (
                                <div
                                  class={['tb-th', canSort ? 'tb-th--sortable' : null]}
                                  onClick={
                                    canSort ? header.column.getToggleSortingHandler() : undefined
                                  }
                                >
                                  <FlexRender
                                    render={header.column.columnDef.header}
                                    props={header.getContext()}
                                  />
                                  {sort ? (
                                    <span class="tb-sort">{sort === 'asc' ? '^' : 'v'}</span>
                                  ) : null}
                                </div>
                              )}
                            </th>
                          )
                        })}
                        {group.headers.map((header) => {
                          const meta = header.column.columnDef.meta as ColumnMeta | undefined
                          const width = meta?.width ? `${meta.width}px` : undefined
                          const align = meta?.align
                          const canSort = header.column.getCanSort()
                          const sort = header.column.getIsSorted()
                          const sticky = stickyMap.value.get(header.column.id)

                          return (
                            <th
                              key={header.id}
                              colspan={header.colSpan}
                              style={{
                                width,
                                textAlign: align,
                                position: sticky ? 'sticky' : undefined,
                                left: sticky?.side === 'left' ? `${sticky.offset}px` : undefined,
                                right: sticky?.side === 'right' ? `${sticky.offset}px` : undefined,
                              }}
                              class={[
                                sticky ? `tb-sticky tb-sticky--${sticky.side}` : null,
                                canSort ? 'tb-sortable' : null,
                              ]}
                            >
                              {header.isPlaceholder ? null : (
                                <div
                                  class={['tb-th', canSort ? 'tb-th--sortable' : null]}
                                  onClick={
                                    canSort ? header.column.getToggleSortingHandler() : undefined
                                  }
                                >
                                  <FlexRender
                                    render={header.column.columnDef.header}
                                    props={header.getContext()}
                                  />
                                  {sort ? (
                                    <span class="tb-sort">{sort === 'asc' ? '^' : 'v'}</span>
                                  ) : null}
                                </div>
                              )}
                            </th>
                          )
                        })}
                        {(rightGroup?.headers ?? []).map((header) => {
                          const meta = header.column.columnDef.meta as ColumnMeta | undefined
                          const width = meta?.width ? `${meta.width}px` : undefined
                          const align = meta?.align
                          const canSort = header.column.getCanSort()
                          const sort = header.column.getIsSorted()
                          const sticky = stickyMap.value.get(header.column.id)

                          return (
                            <th
                              key={header.id}
                              colspan={header.colSpan}
                              style={{
                                width,
                                textAlign: align,
                                position: sticky ? 'sticky' : undefined,
                                left: sticky?.side === 'left' ? `${sticky.offset}px` : undefined,
                                right: sticky?.side === 'right' ? `${sticky.offset}px` : undefined,
                              }}
                              class={[
                                sticky ? `tb-sticky tb-sticky--${sticky.side}` : null,
                                canSort ? 'tb-sortable' : null,
                              ]}
                            >
                              {header.isPlaceholder ? null : (
                                <div
                                  class={['tb-th', canSort ? 'tb-th--sortable' : null]}
                                  onClick={
                                    canSort ? header.column.getToggleSortingHandler() : undefined
                                  }
                                >
                                  <FlexRender
                                    render={header.column.columnDef.header}
                                    props={header.getContext()}
                                  />
                                  {sort ? (
                                    <span class="tb-sort">{sort === 'asc' ? '^' : 'v'}</span>
                                  ) : null}
                                </div>
                              )}
                            </th>
                          )
                        })}
                      </tr>
                    )
                  })}
                </thead>

                <tbody style={{ position: 'relative' }}>
                  {virtualRows.value.map((virtualRow) => {
                    const row = rowModel[virtualRow.index]
                    if (!row) return null

                    const cells = [
                      ...row.getLeftVisibleCells(),
                      ...row.getCenterVisibleCells(),
                      ...row.getRightVisibleCells(),
                    ]

                    return (
                      <tr
                        key={row.id}
                        class={row.getIsSelected() ? 'tb-row--selected' : undefined}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {cells.map((cell) => {
                          const meta = cell.column.columnDef.meta as ColumnMeta | undefined
                          const columnKey = meta?.columnKey ?? cell.column.id
                          const sticky = stickyMap.value.get(cell.column.id)
                          if (meta?.skipSpan) {
                            const width = meta?.width ? `${meta.width}px` : undefined
                            const align = meta?.align
                            return (
                              <td
                                key={cell.id}
                                style={{
                                  width,
                                  textAlign: align,
                                  position: sticky ? 'sticky' : undefined,
                                  left: sticky?.side === 'left' ? `${sticky.offset}px` : undefined,
                                  right:
                                    sticky?.side === 'right' ? `${sticky.offset}px` : undefined,
                                }}
                                class={sticky ? `tb-sticky tb-sticky--${sticky.side}` : undefined}
                              >
                                <FlexRender
                                  render={cell.column.columnDef.cell}
                                  props={cell.getContext()}
                                />
                              </td>
                            )
                          }

                          const span = props.spanMethod
                            ? props.spanMethod({
                                row: row.original,
                                rowIndex: row.index,
                                columnKey,
                              })
                            : { rowspan: 1, colspan: 1 }

                          if (!span.rowspan || !span.colspan) return null

                          const width = meta?.width ? `${meta.width}px` : undefined
                          const align = meta?.align

                          return (
                            <td
                              key={cell.id}
                              rowspan={span.rowspan}
                              colspan={span.colspan}
                              style={{
                                width,
                                textAlign: align,
                                position: sticky ? 'sticky' : undefined,
                                left: sticky?.side === 'left' ? `${sticky.offset}px` : undefined,
                                right: sticky?.side === 'right' ? `${sticky.offset}px` : undefined,
                              }}
                              class={sticky ? `tb-sticky tb-sticky--${sticky.side}` : undefined}
                            >
                              <FlexRender
                                render={cell.column.columnDef.cell}
                                props={cell.getContext()}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {empty ? <div class="tb-empty">{props.emptyText ?? '暂无数据'}</div> : null}
              {props.loading ? (
                <div class="tb-loading">
                  {h('span', { class: 'tb-loading__text' }, 'Loading...')}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )
    }
  },
})
