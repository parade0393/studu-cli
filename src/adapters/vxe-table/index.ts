import type { TableAdapter } from '../table/types'
import { VxeDataTable } from './VxeDataTable'
import { VxeTreeTable } from './VxeTreeTable'

export const vxeTableAdapter: TableAdapter = {
  DataTable: VxeDataTable,
  TreeTable: VxeTreeTable,
  capabilities: {
    groupedHeader: true,
    mergeCells: true,
    treeLazy: true,
    selection: true,
    sort: true,
  },
}
