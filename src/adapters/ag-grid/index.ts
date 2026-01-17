import type { TableAdapter } from '../table/types'
import { AgGridDataTable } from './AgGridDataTable'

export const agGridTableAdapter: TableAdapter = {
  DataTable: AgGridDataTable,
  TreeTable: null,
  capabilities: {
    groupedHeader: true,
    mergeCells: false,
    treeLazy: false,
    selection: true,
    sort: true,
  },
}
