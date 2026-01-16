import type { TableAdapter } from '../table/types'
import { AntDataTable } from './AntDataTable'
import { AntTreeTable } from './AntTreeTable'

export const antDesignVueTableAdapter: TableAdapter = {
  DataTable: AntDataTable,
  TreeTable: AntTreeTable,
  capabilities: {
    groupedHeader: true,
    mergeCells: true,
    treeLazy: true,
    selection: true,
    sort: true,
  },
}
