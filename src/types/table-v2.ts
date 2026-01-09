export type TableV2Align = 'left' | 'center' | 'right'
export type TableV2Fixed = boolean | 'left' | 'right'

export type TableV2Column<T> = {
  key: string
  dataKey: string
  title: string
  width: number
  align?: TableV2Align
  fixed?: TableV2Fixed
  sortable?: boolean
  cellRenderer?: (params: { rowData: T }) => unknown
  headerCellRenderer?: () => unknown
}

export type TableV2HeaderCell = {
  props?: {
    style?: Record<string, string | number>
    column?: { width?: number }
  }
}

export type TableV2HeaderSlotParam = {
  headerIndex: number
  cells: TableV2HeaderCell[]
  columns: Array<{ key?: string; dataKey?: string; width?: number }>
}
