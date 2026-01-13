import { ElAutoResizer, ElEmpty, ElTableV2, TableV2FixedDir } from 'element-plus'
import {
  defineComponent,
  isVNode,
  ref,
  resolveDirective,
  watch,
  withDirectives,
  type VNode,
  type VNodeChild,
} from 'vue'
import type { Column as V2Column } from 'element-plus/es/components/table-v2/src/types'
import type { TableColumnDef, TreeTableHandle, TreeTableProps } from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

type Row = unknown

type FlatRow = Record<string, unknown> & {
  __raw: Row
  __level: number
  __hasChildren: boolean
  __loading: boolean
}

function withLoading(node: VNode, loading: boolean) {
  const dir = resolveDirective('loading')
  return dir ? withDirectives(node, [[dir, loading]]) : node
}

function valueOf(row: Row, col: TableColumnDef<Row>): unknown {
  if (col.valueGetter) return col.valueGetter(row)
  return (row as Record<string, unknown>)[col.key]
}

function renderCell(row: Row, rowIndex: number, col: TableColumnDef<Row>): VNodeChild {
  const Cell = col.cell
  if (Cell) return <Cell row={row} rowIndex={rowIndex} />
  return defaultCellText(valueOf(row, col))
}

function wrapVNode(child: VNodeChild): VNode {
  if (isVNode(child)) return child
  if (child == null || child === false) return <span class="tb-cell-text" />
  if (Array.isArray(child)) return <span class="tb-cell-text">{child}</span>
  return <span class="tb-cell-text">{String(child)}</span>
}

export const ElTreeTableV2 = defineComponent<TreeTableProps<Row>>({
  name: 'ElTreeTableV2Adapter',
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
    const expanded = ref(new Set<string>())
    const flat = ref<FlatRow[]>([])
    const childrenCache = ref(new Map<string, Row[]>())
    const loadingKeys = ref(new Set<string>())

    const rowKey = (row: Row) => getRowKey(props.rowKey, row)

    const rebuildRaf = ref<number | null>(null)
    function scheduleRebuild() {
      if (rebuildRaf.value != null) return
      rebuildRaf.value = window.requestAnimationFrame(() => {
        rebuildRaf.value = null
        rebuild()
      })
    }

    const expandToken = ref(0)

    function toFlatRow(r: Row, level: number): FlatRow {
      const rr = r as Record<string, unknown>
      const key = rowKey(r)
      const cachedChildren = childrenCache.value.get(key)
      const hasChildren =
        Boolean(rr.hasChildren) || (Array.isArray(cachedChildren) && cachedChildren.length > 0)
      return {
        ...rr,
        __raw: r,
        __level: level,
        __hasChildren: hasChildren,
        __loading: loadingKeys.value.has(key),
      }
    }

    function rebuild() {
      const out: FlatRow[] = []
      const roots = props.roots as Row[]
      const push = (rows: Row[], level: number) => {
        for (const r of rows) {
          const fr = toFlatRow(r, level)
          const key = rowKey(r)
          if (!props.filterRow || props.filterRow(fr.__raw)) out.push(fr)
          if (expanded.value.has(key)) {
            const children = childrenCache.value.get(key) ?? []
            if (children.length) push(children, level + 1)
          }
        }
      }
      push(roots, 0)
      flat.value = out
    }

    watch(
      () => [props.roots, props.filterRow],
      () => rebuild(),
      { immediate: true },
    )

    async function ensureExpanded(fr: FlatRow) {
      if (!fr.__hasChildren) return
      const key = rowKey(fr.__raw)
      expanded.value.add(key)
      if (childrenCache.value.has(key)) return
      loadingKeys.value.add(key)
      scheduleRebuild()
      try {
        const children = await props.loadChildren(fr.__raw)
        childrenCache.value.set(key, children)
      } finally {
        loadingKeys.value.delete(key)
        scheduleRebuild()
      }
    }

    async function toggle(fr: FlatRow) {
      if (!fr.__hasChildren) return
      const key = rowKey(fr.__raw)
      if (expanded.value.has(key)) {
        expanded.value.delete(key)
        scheduleRebuild()
        return
      }
      await ensureExpanded(fr)
      scheduleRebuild()
    }

    async function expandTo(level: number) {
      const token = (expandToken.value += 1)
      const targetDepth = Math.max(0, level - 1)
      expanded.value = new Set<string>()
      rebuild()
      for (let depth = 0; depth < targetDepth; depth++) {
        if (token !== expandToken.value) return
        const rowsAtDepth = flat.value.filter((r) => r.__level === depth && r.__hasChildren)
        for (const r of rowsAtDepth) {
          if (token !== expandToken.value) return
          const key = rowKey(r.__raw)
          if (!expanded.value.has(key)) await ensureExpanded(r)
        }
        rebuild()
      }
    }

    function collapseAll() {
      expanded.value = new Set()
      scheduleRebuild()
    }

    expose({ expandTo, collapseAll } satisfies TreeTableHandle)

    return () => {
      const defs = props.columns as TableColumnDef<Row>[]
      const cols: V2Column<Row>[] = []

      for (const [i, d] of defs.entries()) {
        if (i === 0) {
          cols.push({
            key: d.key,
            dataKey: d.key,
            title: d.title,
            width: d.width,
            fixed: TableV2FixedDir.LEFT,
            cellRenderer: ({ rowData, rowIndex }) => {
              const fr = rowData as FlatRow
              const indent = fr.__level * 14
              const key = rowKey(fr.__raw)
              const icon = fr.__hasChildren ? (expanded.value.has(key) ? '▼' : '▶') : ''
              const status = fr.__loading ? '（加载中）' : ''
              return (
                <div
                  style={{
                    paddingLeft: `${indent}px`,
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{ cursor: fr.__hasChildren ? 'pointer' : 'default' }}
                    onClick={() => toggle(fr)}
                  >
                    {icon}
                  </span>
                  <span style={{ cursor: 'pointer' }} onClick={() => props.onRowClick?.(fr.__raw)}>
                    {wrapVNode(
                      renderCell(fr.__raw, typeof rowIndex === 'number' ? rowIndex : 0, d),
                    )}
                  </span>
                  <span style={{ color: 'var(--el-text-color-secondary)' }}>{status}</span>
                </div>
              )
            },
          })
        } else {
          cols.push({
            key: d.key,
            dataKey: d.key,
            title: d.title,
            width: d.width,
            align: d.align,
            fixed: d.fixed
              ? d.fixed === 'left'
                ? TableV2FixedDir.LEFT
                : TableV2FixedDir.RIGHT
              : undefined,
            cellRenderer: ({ rowData, rowIndex }) =>
              wrapVNode(
                renderCell(
                  (rowData as FlatRow).__raw,
                  typeof rowIndex === 'number' ? rowIndex : 0,
                  d,
                ),
              ),
          })
        }
      }

      const node = (
        <div class={['tb-skin', props.border ? 'tb-bordered' : null]}>
          <div
            style={{
              height: typeof props.height === 'number' ? `${props.height}px` : props.height,
              width: '100%',
              position: 'relative',
            }}
          >
            {flat.value.length === 0 ? (
              <div class="tb-empty">
                <ElEmpty description={props.emptyText ?? '暂无数据'} />
              </div>
            ) : null}
            <ElAutoResizer>
              {({ height, width }: { height: number; width: number }) => (
                <ElTableV2
                  class="tb-table tb-table--v2"
                  columns={cols}
                  data={flat.value}
                  width={width}
                  height={height}
                  fixed
                  headerHeight={40}
                  rowHeight={44}
                />
              )}
            </ElAutoResizer>
          </div>
        </div>
      )

      return withLoading(node, props.loading === true)
    }
  },
})
