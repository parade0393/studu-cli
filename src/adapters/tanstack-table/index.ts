import type { TableAdapter } from '../table/types'
import { TanstackDataTable } from './TanstackDataTable'

export const tanstackTableAdapter: TableAdapter = {
  DataTable: TanstackDataTable,
  TreeTable: null,
  capabilities: {
    groupedHeader: true,
    mergeCells: true,
    treeLazy: false,
    selection: true,
    sort: true,
  },
}
