import {
  ElAutoResizer,
  ElCheckbox,
  ElEmpty,
  ElTableV2,
  TableV2FixedDir,
  TableV2SortOrder,
} from 'element-plus'
import type { SortBy, TableV2CustomizedHeaderSlotParam } from 'element-plus'
import type { Column as V2Column } from 'element-plus/es/components/table-v2/src/types'
import {
  defineComponent,
  isVNode,
  resolveDirective,
  withDirectives,
  type VNode,
  type VNodeChild,
} from 'vue'
import type {
  DataTableProps,
  TableColumnDef,
  TableHeaderGroup,
  TableSortRule,
} from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

type Row = unknown

function withLoading(node: VNode, loading: boolean) {
  const dir = resolveDirective('loading')
  return dir ? withDirectives(node, [[dir, loading]]) : node
}

function valueOf(row: Row, col: TableColumnDef<Row>): unknown {
  if (col.valueGetter) return col.valueGetter(row)
  return (row as Record<string, unknown>)[col.key]
}

function toV2Sort(sort: TableSortRule[] | undefined): SortBy | undefined {
  const s = sort?.[0]
  if (!s) return undefined
  return { key: s.key, order: s.order === 'asc' ? TableV2SortOrder.ASC : TableV2SortOrder.DESC }
}

function fromV2Sort(sortBy: SortBy): TableSortRule[] {
  if (!sortBy.key || !sortBy.order) return []
  return [
    { key: String(sortBy.key), order: sortBy.order === TableV2SortOrder.ASC ? 'asc' : 'desc' },
  ]
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

function buildHeaderRenderer(groups: TableHeaderGroup<Row>[]) {
  //建立一个映射：列的 key → 所属分组的标题
  const keyToGroup = new Map<string, string>()
  for (const g of groups) {
    for (const c of g.columns) keyToGroup.set(c.key, g.title)
  }

  const keyOf = (col: { dataKey?: unknown; key?: unknown }) => String(col.dataKey ?? col.key ?? '')
  //判断是否是系统列（序号列 _index 或选择列 __sel） 序号列或者选择列
  const isStandaloneHeader = (key: string) => key === '_index' || key === '__sel'

  return ({ cells, columns, headerIndex }: TableV2CustomizedHeaderSlotParam) => {
    const systemCount = columns.findIndex((c) => !c || !isStandaloneHeader(keyOf(c)))
    const start = systemCount === -1 ? columns.length : systemCount

    if (headerIndex === 1) {
      const row2: VNodeChild[] = []
      // 系统列在第二行显示空占位符,（因为在第一行已经跨行显示）
      for (let i = 0; i < start; i++) {
        const col = columns[i]
        if (!col) continue
        row2.push(
          <div
            role="columnheader"
            class="tb-v2-standalone-header--placeholder"
            style={{ width: `${Number(col.width ?? 0)}px`, height: 0 }}
          />,
        )
      }
      // 业务列使用默认的列标题
      row2.push(...cells.slice(start))
      return row2
    }

    const groupCells: VNodeChild[] = []
    let width = 0
    let currentLabel = ''

    const flush = (label: string) => {
      if (!label) {
        groupCells.push(
          <div role="columnheader" class="tb-v2-group-header" style={{ width: `${width}px` }} />,
        )
        width = 0
        return
      }
      groupCells.push(
        <div role="columnheader" class="tb-v2-group-header" style={{ width: `${width}px` }}>
          {label}
        </div>,
      )
      width = 0
    }

    // 系统列在第一行显示实际内容（看起来跨两行）
    for (let i = 0; i < start; i++) {
      const col = columns[i]
      if (!col) continue
      groupCells.push(
        <div
          role="columnheader"
          class="tb-v2-standalone-header tb-v2-standalone-header--top"
          style={{ width: `${Number(col.width ?? 0)}px` }}
        >
          {cells[i]}
        </div>,
      )
    }

    for (let i = start; i < columns.length; i++) {
      const col = columns[i]
      if (!col) continue
      const key = keyOf(col)
      const label = keyToGroup.get(key) ?? ''
      if (i === start) currentLabel = label

      width += Number(col.width ?? 0)

      const next = columns[i + 1]
      const nextKey = next ? keyOf(next) : ''
      const nextLabel = keyToGroup.get(nextKey) ?? ''
      if (i === columns.length - 1 || nextLabel !== currentLabel) {
        flush(currentLabel)
        currentLabel = nextLabel
      }
    }

    return groupCells
  }
}

export const ElDataTableV2 = defineComponent<DataTableProps<Row>>({
  name: 'ElDataTableV2Adapter',
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
    return () => {
      const data = props.rows as Row[]
      const rowKey = (r: Row) => getRowKey(props.rowKey, r)
      const selected = new Set(props.selectedRowKeys ?? [])

      const columns: V2Column<Row>[] = []
      columns.push({
        key: '_index',
        dataKey: '_index',
        width: 50,
        align: 'center',
        cellRenderer: ({ rowIndex }) => wrapVNode(`${rowIndex + 1}`),
        fixed: TableV2FixedDir.LEFT,
      })

      if (props.selection && props.onUpdateSelectedRowKeys) {
        columns.push({
          key: '__sel',
          dataKey: '__sel',
          title: '',
          width: 50,
          align: 'center',
          fixed: TableV2FixedDir.LEFT,
          headerCellRenderer: () => {
            const all = data.length > 0 && data.every((r) => selected.has(rowKey(r)))
            const containsChecked = data.length > 0 && data.some((r) => selected.has(rowKey(r)))
            return (
              <ElCheckbox
                modelValue={all}
                onUpdate:modelValue={(v: unknown) => {
                  const checked = v === true
                  const keys = checked ? data.map((r) => rowKey(r)) : []
                  props.onUpdateSelectedRowKeys?.(keys)
                }}
                indeterminate={containsChecked}
              />
            )
          },
          cellRenderer: ({ rowData }) =>
            wrapVNode(
              <ElCheckbox
                modelValue={selected.has(rowKey(rowData))}
                onUpdate:modelValue={(v: unknown) => {
                  const checked = v === true
                  const next = new Set(selected)
                  const k = rowKey(rowData)
                  if (checked) next.add(k)
                  else next.delete(k)
                  props.onUpdateSelectedRowKeys?.([...next])
                }}
              />,
            ),
        })
      }

      const defs = props.columns as TableColumnDef<Row>[]
      for (const d of defs) {
        columns.push({
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
          sortable: d.sortable,
          cellRenderer: ({ rowData, rowIndex }) =>
            wrapVNode(renderCell(rowData, typeof rowIndex === 'number' ? rowIndex : 0, d)),
        })
      }

      const v2Sort = toV2Sort(props.sort)
      const headerGroups = props.headerGroups as TableHeaderGroup<Row>[] | undefined
      const headerRenderer =
        headerGroups && headerGroups.length ? buildHeaderRenderer(headerGroups) : undefined
      const headerHeight = headerRenderer ? [40, 40] : 40

      const sortByProps: Partial<{ sortBy: SortBy }> = v2Sort ? { sortBy: v2Sort } : {}

      const node = (
        <div class={['tb-skin', props.border ? 'tb-bordered' : null]}>
          <div
            style={{
              height: typeof props.height === 'number' ? `${props.height}px` : props.height,
              width: '100%',
              position: 'relative',
            }}
          >
            {data.length === 0 ? (
              <div class="tb-empty">
                <ElEmpty description={props.emptyText ?? '暂无数据'} />
              </div>
            ) : null}
            <ElAutoResizer>
              {({ height, width }: { height: number; width: number }) => (
                <ElTableV2
                  {...sortByProps}
                  class="tb-table tb-table--v2"
                  columns={columns}
                  data={data}
                  width={width}
                  height={height}
                  fixed
                  headerHeight={headerHeight}
                  rowHeight={44}
                  onColumnSort={
                    props.onUpdateSort
                      ? (sb: SortBy) => props.onUpdateSort?.(fromV2Sort(sb))
                      : undefined
                  }
                >
                  {{
                    header: headerRenderer
                      ? (p: TableV2CustomizedHeaderSlotParam) => headerRenderer(p)
                      : undefined,
                  }}
                </ElTableV2>
              )}
            </ElAutoResizer>
          </div>
        </div>
      )

      return withLoading(node, props.loading === true)
    }
  },
})
