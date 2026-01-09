import type { Component, FunctionalComponent } from 'vue'

export type TableAlign = 'left' | 'center' | 'right'
export type TableFixed = 'left' | 'right'

export type TableSortOrder = 'asc' | 'desc'
export type TableSortRule = { key: string; order: TableSortOrder }

export type TableCellCtx<Row> = { row: Row; rowIndex: number }

export type TableCellRenderer<Row> = FunctionalComponent<TableCellCtx<Row>>

export type TableColumnDef<Row> = {
  key: string
  title: string
  width: number
  align?: TableAlign
  fixed?: TableFixed
  sortable?: boolean
  valueGetter?: (row: Row) => unknown
  cell?: TableCellRenderer<Row>
  headerCell?: FunctionalComponent
}

export type TableHeaderGroup<Row> = {
  title: string
  columns: TableColumnDef<Row>[]
}

export type RowKey<Row> = keyof Row | ((row: Row) => string)

export type DataTableProps<Row> = {
  rows: Row[]
  rowKey: RowKey<Row>
  height: string | number
  loading?: boolean
  border?: boolean
  columns: TableColumnDef<Row>[]
  headerGroups?: TableHeaderGroup<Row>[]
  selection?: boolean
  selectedRowKeys?: string[]
  onUpdateSelectedRowKeys?: (keys: string[]) => void
  sort?: TableSortRule[]
  onUpdateSort?: (sort: TableSortRule[]) => void
  spanMethod?: (params: { row: Row; rowIndex: number; columnKey: string }) => {
    rowspan: number
    colspan: number
  }
  emptyText?: string
}

export type TreeLoadChildren<Row> = (row: Row) => Promise<Row[]>

export type TreeTableProps<Row> = {
  roots: Row[]
  rowKey: RowKey<Row>
  height: string | number
  loading?: boolean
  border?: boolean
  columns: TableColumnDef<Row>[]
  loadChildren: TreeLoadChildren<Row>
  selection?: boolean
  selectedRowKeys?: string[]
  onUpdateSelectedRowKeys?: (keys: string[]) => void
  onRowClick?: (row: Row) => void
  filterRow?: (row: Row) => boolean
  emptyText?: string
}

export type TreeTableHandle = {
  collapseAll: () => void
  expandTo: (level: number) => Promise<void>
}

export type TableAdapter = {
  DataTable: Component
  TreeTable: Component | null
  capabilities: {
    groupedHeader: boolean
    mergeCells: boolean
    treeLazy: boolean
    selection: boolean
    sort: boolean
  }
}
