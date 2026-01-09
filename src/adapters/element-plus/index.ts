import type { TableAdapter } from '../table/types'
import { ElDataTable } from './ElDataTable'
import { ElDataTableV2 } from './ElDataTableV2'
import { ElTreeTable } from './ElTreeTable'
import { ElTreeTableV2 } from './ElTreeTableV2'

export const elementPlusTableAdapter: TableAdapter = {
  DataTable: ElDataTable,
  TreeTable: ElTreeTable,
  capabilities: {
    groupedHeader: true,
    mergeCells: true,
    treeLazy: true,
    selection: true,
    sort: true,
  },
}

export const elementPlusTableV2Adapter: TableAdapter = {
  DataTable: ElDataTableV2,
  TreeTable: ElTreeTableV2,
  capabilities: {
    groupedHeader: true,
    mergeCells: false,
    treeLazy: false,
    selection: true,
    sort: true,
  },
}
