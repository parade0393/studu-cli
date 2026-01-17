import type { TableAdapter } from '../table/types'
import { VxeDataTable } from './VxeDataTable'

export const vxeTableAdapter: TableAdapter = {
  DataTable: VxeDataTable,
  TreeTable: null,
  capabilities: {
    groupedHeader: true,
    mergeCells: true,
    treeLazy: false,
    selection: true,
    sort: true,
  },
}
