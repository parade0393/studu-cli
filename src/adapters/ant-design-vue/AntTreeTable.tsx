import { Table, Spin, Empty } from 'ant-design-vue'
import type { ColumnType } from 'ant-design-vue/es/table'
import { defineComponent, ref, computed, type VNodeChild } from 'vue'
import type { TableColumnDef, TreeTableProps } from '../table/types'
import { defaultCellText, getRowKey } from '../table/utils'

type Row = Record<string, unknown>

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
    console.error('[AntTreeTable] cell render error', { columnKey: col.key, rowIndex, error: e })
    return <span style={{ color: '#ff4d4f' }}>RenderError</span>
  }
}

function buildColumns(columns: TableColumnDef<Row>[]): ColumnType<Row>[] {
  return columns.map((col) => ({
    key: col.key,
    dataIndex: col.key,
    title: col.title,
    width: col.width,
    fixed: col.fixed,
    align: col.align,
    ellipsis: { showTitle: true },
    customRender: ({ record, index }) => renderCell(record, index, col),
  }))
}

export const AntTreeTable = defineComponent<TreeTableProps<Row>>({
  name: 'AntTreeTableAdapter',
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
  setup(props) {
    const rowKeyFn = (row: Row) => getRowKey(props.rowKey, row)
    const expandedKeys = ref<string[]>([])
    const loadedKeys = ref<Set<string>>(new Set())
    const childrenMap = ref<Map<string, Row[]>>(new Map())

    const tableColumns = computed<ColumnType<Row>[]>(() => {
      return buildColumns(props.columns as TableColumnDef<Row>[])
    })

    const treeData = computed(() => {
      const roots = props.filterRow
        ? (props.roots as Row[]).filter((r) => props.filterRow?.(r))
        : (props.roots as Row[])

      function buildNode(row: Row): Row & { children?: Row[] } {
        const key = rowKeyFn(row)
        const hasChildren = (row as { hasChildren?: boolean }).hasChildren
        const loadedChildren = childrenMap.value.get(key)

        if (loadedChildren) {
          const filtered = props.filterRow
            ? loadedChildren.filter((c) => props.filterRow?.(c))
            : loadedChildren
          return {
            ...row,
            children: filtered.map(buildNode),
          }
        }

        if (hasChildren) {
          return { ...row, children: [] }
        }

        return row
      }

      return roots.map(buildNode)
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

    const onExpand = async (expanded: boolean, record: Row) => {
      const key = rowKeyFn(record)

      if (expanded) {
        if (!loadedKeys.value.has(key)) {
          const children = await props.loadChildren(record)
          childrenMap.value.set(key, children)
          loadedKeys.value.add(key)
        }
        if (!expandedKeys.value.includes(key)) {
          expandedKeys.value = [...expandedKeys.value, key]
        }
      } else {
        expandedKeys.value = expandedKeys.value.filter((k) => k !== key)
      }
    }

    const customRow = (record: Row) => ({
      onClick: () => {
        props.onRowClick?.(record)
      },
    })

    return () => {
      return (
        <div class="tb-skin">
          <Spin spinning={props.loading}>
            <Table
              class="tb-table"
              dataSource={treeData.value}
              rowKey={rowKeyFn}
              columns={tableColumns.value}
              rowSelection={rowSelection.value}
              bordered={props.border}
              pagination={false}
              scroll={{ y: scrollY.value, x: 'max-content' }}
              size="middle"
              expandedRowKeys={expandedKeys.value}
              onExpand={onExpand}
              customRow={props.onRowClick ? customRow : undefined}
              locale={{ emptyText: () => <Empty description={props.emptyText ?? '暂无数据'} /> }}
            />
          </Spin>
        </div>
      )
    }
  },
})
