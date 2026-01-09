export type SortOrder = 'asc' | 'desc'

export type SortRule = { field: string; order: SortOrder }

/**
 * 过滤操作符（见 doc/table-benchmark/PRD.md 4.1）。
 * 说明：这里的 op 与 UI 组件/表格库无关，仅用于统一 mock/local 的参数口径。
 */
export type FilterOp = 'textContains' | 'enumIn' | 'numberRange' | 'dateRange' | 'boolean'

export type FilterRule = { field: string; op: FilterOp; value: unknown }

/**
 * 统一 query 参数模型（PRD 4.1）。
 * - local：前端使用该参数对全量数据做 sort/filter/paginate
 * - server(mock)：mock API 使用同一模型返回切片，保证口径一致便于对比
 */
export type Query = {
  page: number
  pageSize: number
  sort: SortRule[]
  filters: FilterRule[]
}

export type InventoryRow = {
  id: string
  warehouse: string
  zone: string
  bin: string
  sku: string
  skuName: string
  batch: string
  owner: string
  supplier: string
  qualityStatus: 'OK' | 'HOLD' | 'NG'
  freezeStatus: 'NONE' | 'FROZEN'
  abcClass: 'A' | 'B' | 'C'
  riskLevel: 1 | 2 | 3 | 4 | 5
  onHand: number
  available: number
  reserved: number
  damaged: number
  frozen: number
  inboundAt: string
  lastMoveAt: string
  expireAt: string
  [ext: `ext${string}`]: unknown
}

export type TreeNode = {
  id: string
  parentId?: string
  type: 'warehouse' | 'zone' | 'bin' | 'batchStock'
  name: string
  hasChildren: boolean
  level: number
  availableSum?: number
  expireAtMin?: string
  children?: TreeNode[]
}

export type PickLineStatus = 'clean' | 'dirty' | 'validating' | 'error' | 'ready' | 'submitted'

export type PickLineError = { field: string; message: string }

export type PickLine = {
  lineId: string
  sourceId: string
  sku: string
  skuName: string
  batch: string
  bin: string
  available: number
  pickQty: number | null
  pickerId: string | null
  pickerName: string | null
  strategy: 'FIFO' | 'FEFO' | 'MANUAL' | 'ZONE_FIRST'
  remark: string
  rowStatus: PickLineStatus
  errors: PickLineError[]
}

export type ExceptionRow = {
  id: string
  type: 'SHORT' | 'EXPIRE_RISK' | 'FROZEN' | 'COUNT_DIFF'
  sku: string
  skuName: string
  bin: string
  riskLevel: 1 | 2 | 3 | 4 | 5
  createdAt: string
  status: 'OPEN' | 'PROCESSING' | 'DONE'
  assignee: string | null
  message: string
}

export type Picker = { id: string; name: string }
