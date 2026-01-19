import {
  FlexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useVueTable,
  type ColumnDef,
  type ExpandedState,
} from '@tanstack/vue-table'
import { computed, defineComponent, ref, type VNodeChild } from 'vue'
import type { TableAlign, TableColumnDef, TreeTableHandle, TreeTableProps } from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

type Row = Record<string, unknown>

type TreeRow = Row & {
  hasChildren?: boolean
  children?: TreeRow[]
}

type ColumnMeta = {
  width?: number
  align?: TableAlign
  columnKey?: string
  fixed?: 'left' | 'right'
}

type StickyPosition = {
  side: 'left' | 'right'
  offset: number
}

type Updater<T> = T | ((old: T) => T)

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(prev) : updater
}

function valueOf(row: Row, col: TableColumnDef<Row>): unknown {
  if (col.valueGetter) return col.valueGetter(row)
  return row[col.key]
}

function renderCell(row: Row, rowIndex: number, col: TableColumnDef<Row>): VNodeChild {
  try {
    const Cell = col.cell
    if (Cell) return <Cell row={row} rowIndex={rowIndex} />
    return defaultCellText(valueOf(row, col))
  } catch (e) {
    console.error('[TanstackTreeTable] cell render error', {
      columnKey: col.key,
      rowIndex,
      error: e,
    })
    return <span style={{ color: 'var(--el-color-danger)' }}>RenderError</span>
  }
}

export const TanstackTreeTable = defineComponent<TreeTableProps<Row>>({
  name: 'TanstackTreeTableAdapter',
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
    const rowKeyFn = (row: Row) => getRowKey(props.rowKey, row)
    const expanded = ref<ExpandedState>({})
    const childrenMap = ref<Map<string, Row[]>>(new Map())
    const loadingKeys = ref<Set<string>>(new Set())
    const expandToken = ref(0)

    const treeData = computed<TreeRow[]>(() => {
      const roots = props.filterRow
        ? (props.roots as Row[]).filter((r) => props.filterRow?.(r))
        : (props.roots as Row[])

      const buildNode = (row: Row): TreeRow => {
        const key = rowKeyFn(row)
        const cachedChildren = childrenMap.value.get(key)
        const inlineChildren = Array.isArray((row as TreeRow).children)
          ? (row as TreeRow).children
          : undefined
        const children = cachedChildren ?? inlineChildren

        if (children) {
          const filtered = props.filterRow ? children.filter((c) => props.filterRow?.(c)) : children
          return {
            ...(row as TreeRow),
            children: filtered.map(buildNode),
          }
        }

        if ((row as TreeRow).hasChildren) {
          return { ...(row as TreeRow), children: [] }
        }

        return row as TreeRow
      }

      return roots.map(buildNode)
    })

    async function ensureChildren(row: TreeRow) {
      if (!row.hasChildren) return
      const key = rowKeyFn(row)
      if (childrenMap.value.has(key)) return
      const inlineChildren = Array.isArray(row.children) ? row.children : undefined
      if (inlineChildren && inlineChildren.length > 0) {
        childrenMap.value.set(key, inlineChildren)
        return
      }
      if (loadingKeys.value.has(key)) return
      loadingKeys.value.add(key)
      try {
        const children = await props.loadChildren(row)
        childrenMap.value.set(key, children)
      } finally {
        loadingKeys.value.delete(key)
      }
    }

    const columnPinning = computed(() => {
      const defs = props.columns as TableColumnDef<Row>[]
      const left: string[] = []
      const right: string[] = []

      defs.forEach((col) => {
        if (col.fixed === 'left') left.push(col.key)
        if (col.fixed === 'right') right.push(col.key)
      })

      return { left, right }
    })

    const columnDefs = computed<ColumnDef<Row>[]>(() => {
      const defs = props.columns as TableColumnDef<Row>[]
      return defs.map((col, index) => {
        const Header = col.headerCell
        const base: ColumnDef<Row> = {
          id: col.key,
          accessorKey: col.key,
          header: Header ? () => <Header /> : col.title,
          enableSorting: false,
          meta: {
            width: col.width,
            align: col.align,
            columnKey: col.key,
            fixed: col.fixed,
          } satisfies ColumnMeta,
        }

        if (index !== 0) {
          return {
            ...base,
            cell: (info) => renderCell(info.row.original, info.row.index, col),
          }
        }

        return {
          ...base,
          cell: (info) => {
            const row = info.row
            const depth = row.depth
            const canExpand = row.getCanExpand()
            const isExpanded = row.getIsExpanded()
            const key = rowKeyFn(row.original)
            const isLoading = loadingKeys.value.has(key)
            const indent = depth * 14
            const toggle = async (event: MouseEvent) => {
              event.stopPropagation()
              if (!canExpand) return
              if (!isExpanded) {
                await ensureChildren(row.original as TreeRow)
              }
              row.toggleExpanded(!isExpanded)
            }

            return (
              <div class="tb-tree-cell" style={{ paddingLeft: `${indent}px` }}>
                {canExpand ? (
                  <span class="tb-tree-toggle" onClick={toggle}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                ) : (
                  <span class="tb-tree-toggle-spacer" />
                )}
                <span>{renderCell(row.original, row.index, col)}</span>
                {isLoading ? <span class="tb-tree-loading">加载中</span> : null}
              </div>
            )
          },
        }
      })
    })

    const table = useVueTable({
      get data() {
        return treeData.value
      },
      get columns() {
        return columnDefs.value
      },
      getRowId: (row) => rowKeyFn(row),
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      getSubRows: (row) => {
        const key = rowKeyFn(row as Row)
        const cachedChildren = childrenMap.value.get(key)
        if (cachedChildren) return cachedChildren
        const inlineChildren = Array.isArray((row as TreeRow).children)
          ? (row as TreeRow).children
          : undefined
        if (inlineChildren && inlineChildren.length > 0) return inlineChildren
        return undefined
      },
      getRowCanExpand: (row) => {
        const original = row.original as TreeRow
        return Boolean(original.hasChildren || row.subRows?.length)
      },
      enableExpanding: true,
      enableColumnPinning: true,
      state: {
        get expanded() {
          return expanded.value
        },
        get columnPinning() {
          return columnPinning.value
        },
      },
      onExpandedChange: (updater) => {
        expanded.value = resolveUpdater(updater, expanded.value)
      },
    })

    const stickyMap = computed(() => {
      const leftColumns = table.getLeftVisibleLeafColumns()
      const rightColumns = table.getRightVisibleLeafColumns()
      const map = new Map<string, StickyPosition>()
      let offset = 0
      leftColumns.forEach((column) => {
        const meta = column.columnDef.meta as ColumnMeta | undefined
        const width = meta?.width ?? 0
        map.set(column.id, { side: 'left', offset })
        offset += width
      })
      offset = 0
      for (let i = rightColumns.length - 1; i >= 0; i -= 1) {
        const column = rightColumns[i]
        if (!column) continue
        const meta = column.columnDef.meta as ColumnMeta | undefined
        const width = meta?.width ?? 0
        map.set(column.id, { side: 'right', offset })
        offset += width
      }

      return map
    })

    const visibleLeafColumns = computed(() => [
      ...table.getLeftVisibleLeafColumns(),
      ...table.getCenterVisibleLeafColumns(),
      ...table.getRightVisibleLeafColumns(),
    ])

    const tableWidth = computed(() =>
      visibleLeafColumns.value.reduce((sum, column) => {
        const meta = column.columnDef.meta as ColumnMeta | undefined
        const width = meta?.width ?? 120
        return sum + width
      }, 0),
    )

    const heightStyle = computed(() =>
      typeof props.height === 'number' ? `${props.height}px` : String(props.height),
    )

    async function expandTo(level: number) {
      const token = (expandToken.value += 1)
      const targetDepth = Math.max(0, level - 1)
      const nextExpanded = new Set<string>()

      const collectAtDepth = (rows: TreeRow[], depth: number, out: TreeRow[]) => {
        for (const row of rows) {
          if (depth === 0) {
            out.push(row)
            continue
          }
          const children = row.children ?? []
          if (children.length) collectAtDepth(children, depth - 1, out)
        }
      }

      for (let depth = 0; depth < targetDepth; depth += 1) {
        if (token !== expandToken.value) return
        const nodes: TreeRow[] = []
        collectAtDepth(treeData.value, depth, nodes)
        for (const node of nodes) {
          if (token !== expandToken.value) return
          if (!node.hasChildren) continue
          await ensureChildren(node)
          nextExpanded.add(rowKeyFn(node))
        }
      }

      expanded.value = Object.fromEntries([...nextExpanded].map((key) => [key, true]))
    }

    function collapseAll() {
      expanded.value = {}
    }

    expose({ expandTo, collapseAll } satisfies TreeTableHandle)

    return () => {
      const data = treeData.value
      const empty = !data.length
      const rowModel = table.getRowModel().rows
      const headerGroups = table.getCenterHeaderGroups()

      return (
        <div class={['tb-skin', props.border ? 'tb-bordered' : null]}>
          <div class="tb-table-shell">
            <div class="tb-table-scroll" style={{ height: heightStyle.value }}>
              <table
                class="tb-table tb-table--tanstack"
                style={{ width: `${tableWidth.value}px`, minWidth: '100%' }}
              >
                <colgroup>
                  {visibleLeafColumns.value.map((column) => {
                    const meta = column.columnDef.meta as ColumnMeta | undefined
                    const width = meta?.width ?? 120
                    return <col key={column.id} style={{ width: `${width}px` }} />
                  })}
                </colgroup>
                <thead>
                  {headerGroups.map((group, index) => {
                    const leftGroup = table.getLeftHeaderGroups()[index]
                    const rightGroup = table.getRightHeaderGroups()[index]

                    return (
                      <tr key={group.id}>
                        {(leftGroup?.headers ?? []).map((header) => {
                          const meta = header.column.columnDef.meta as ColumnMeta | undefined
                          const width = meta?.width ? `${meta.width}px` : undefined
                          const align = meta?.align
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
                              class={sticky ? `tb-sticky tb-sticky--${sticky.side}` : undefined}
                            >
                              {header.isPlaceholder ? null : (
                                <div class="tb-th">
                                  <FlexRender
                                    render={header.column.columnDef.header}
                                    props={header.getContext()}
                                  />
                                </div>
                              )}
                            </th>
                          )
                        })}
                        {group.headers.map((header) => {
                          const meta = header.column.columnDef.meta as ColumnMeta | undefined
                          const width = meta?.width ? `${meta.width}px` : undefined
                          const align = meta?.align
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
                              class={sticky ? `tb-sticky tb-sticky--${sticky.side}` : undefined}
                            >
                              {header.isPlaceholder ? null : (
                                <div class="tb-th">
                                  <FlexRender
                                    render={header.column.columnDef.header}
                                    props={header.getContext()}
                                  />
                                </div>
                              )}
                            </th>
                          )
                        })}
                        {(rightGroup?.headers ?? []).map((header) => {
                          const meta = header.column.columnDef.meta as ColumnMeta | undefined
                          const width = meta?.width ? `${meta.width}px` : undefined
                          const align = meta?.align
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
                              class={sticky ? `tb-sticky tb-sticky--${sticky.side}` : undefined}
                            >
                              {header.isPlaceholder ? null : (
                                <div class="tb-th">
                                  <FlexRender
                                    render={header.column.columnDef.header}
                                    props={header.getContext()}
                                  />
                                </div>
                              )}
                            </th>
                          )
                        })}
                      </tr>
                    )
                  })}
                </thead>
                <tbody>
                  {rowModel.map((row) => {
                    const cells = [
                      ...row.getLeftVisibleCells(),
                      ...row.getCenterVisibleCells(),
                      ...row.getRightVisibleCells(),
                    ]

                    return (
                      <tr
                        key={row.id}
                        onClick={() => props.onRowClick?.(row.original)}
                        class={row.getIsSelected() ? 'tb-row--selected' : undefined}
                      >
                        {cells.map((cell) => {
                          const meta = cell.column.columnDef.meta as ColumnMeta | undefined
                          const sticky = stickyMap.value.get(cell.column.id)
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
                  <span class="tb-loading__text">Loading...</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )
    }
  },
})
