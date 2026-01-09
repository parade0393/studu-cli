export type InventoryColumnKey =
  | 'sku'
  | 'skuName'
  | 'batch'
  | 'owner'
  | 'supplier'
  | 'warehouse'
  | 'zone'
  | 'bin'
  | 'onHand'
  | 'available'
  | 'reserved'
  | 'damaged'
  | 'frozen'
  | 'qualityStatus'
  | 'freezeStatus'
  | 'abcClass'
  | 'riskLevel'
  | 'inboundAt'
  | 'lastMoveAt'
  | 'expireAt'
  | 'id'
  | 'opView'
  | 'opCopySku'
  | `ext${string}`

export type InventoryColumnSpec = {
  key: InventoryColumnKey
  title: string
  width: number
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right'
}

const base: InventoryColumnSpec[] = [
  { key: 'sku', title: 'SKU', width: 140, fixed: 'left' },
  { key: 'skuName', title: '名称', width: 220, fixed: 'left' },
  { key: 'batch', title: '批次', width: 140 },
  { key: 'owner', title: '货主', width: 140 },
  { key: 'supplier', title: '供应商', width: 160 },
  { key: 'warehouse', title: '仓库', width: 120 },
  { key: 'zone', title: '库区', width: 120 },
  { key: 'bin', title: '库位', width: 140 },
  { key: 'onHand', title: '现有', width: 110, align: 'right' },
  { key: 'available', title: '可用', width: 110, align: 'right', fixed: 'right' },
  { key: 'reserved', title: '占用', width: 110, align: 'right' },
  { key: 'damaged', title: '残损', width: 110, align: 'right' },
  { key: 'frozen', title: '冻结数', width: 110, align: 'right' },
  { key: 'qualityStatus', title: '质量', width: 100, align: 'center' },
  { key: 'freezeStatus', title: '冻结状态', width: 110, align: 'center' },
  { key: 'abcClass', title: 'ABC', width: 80, align: 'center' },
  { key: 'riskLevel', title: '风险等级', width: 110, align: 'center' },
  { key: 'inboundAt', title: '入库时间', width: 160 },
  { key: 'lastMoveAt', title: '最后移动', width: 160 },
  { key: 'expireAt', title: '效期', width: 160 },
  { key: 'id', title: '行ID', width: 160 },
  { key: 'opView', title: '查看', width: 90, align: 'center', fixed: 'right' },
  { key: 'opCopySku', title: '复制SKU', width: 110, align: 'center', fixed: 'right' },
  { key: 'extText1', title: '扩展文本1', width: 140 },
  { key: 'extText2', title: '扩展文本2', width: 140 },
  { key: 'extEnum1', title: '扩展枚举1', width: 120, align: 'center' },
  { key: 'extEnum2', title: '扩展枚举2', width: 120, align: 'center' },
  { key: 'extNum1', title: '扩展数值1', width: 120, align: 'right' },
  { key: 'extNum2', title: '扩展数值2', width: 120, align: 'right' },
  { key: 'extDate1', title: '扩展日期1', width: 160 },
]

export function getInventoryColumns(columnSize: 30 | 60 | 120): InventoryColumnSpec[] {
  const cols = [...base]
  if (columnSize === 30) return cols

  const target = columnSize
  let idxText = 3
  let idxEnum = 3
  let idxNum = 3
  let idxDate = 2

  while (cols.length < target) {
    const mod = cols.length % 4
    if (mod === 0)
      cols.push({ key: `extText${idxText++}`, title: `扩展文本${idxText - 1}`, width: 140 })
    if (mod === 1)
      cols.push({
        key: `extEnum${idxEnum++}`,
        title: `扩展枚举${idxEnum - 1}`,
        width: 120,
        align: 'center',
      })
    if (mod === 2)
      cols.push({
        key: `extNum${idxNum++}`,
        title: `扩展数值${idxNum - 1}`,
        width: 120,
        align: 'right',
      })
    if (mod === 3)
      cols.push({ key: `extDate${idxDate++}`, title: `扩展日期${idxDate - 1}`, width: 160 })
  }

  return cols
}
