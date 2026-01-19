import type { TableAdapter } from '../table/types'
import { TanstackDataTable } from './TanstackDataTable'
import { TanstackTreeTable } from './TanstackTreeTable'

export const tanstackTableAdapter: TableAdapter = {
  DataTable: TanstackDataTable,
  TreeTable: TanstackTreeTable,
  capabilities: {
    groupedHeader: true,
    mergeCells: true,
    treeLazy: true,
    selection: true,
    sort: true,
  },
}
