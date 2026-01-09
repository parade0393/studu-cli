<template>
  <div class="view">
    <el-card shadow="never">
      <el-form :inline="true" label-width="70px" size="small">
        <el-form-item label="仓库">
          <el-select v-model="form.warehouse" clearable style="width: 140px">
            <el-option label="WH-A" value="WH-A" />
            <el-option label="WH-B" value="WH-B" />
            <el-option label="WH-C" value="WH-C" />
          </el-select>
        </el-form-item>
        <el-form-item label="库区">
          <el-select v-model="form.zone" clearable style="width: 120px">
            <el-option v-for="z in zones" :key="z" :label="z" :value="z" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="form.keyword" clearable placeholder="sku/名称" style="width: 160px" />
        </el-form-item>
        <el-form-item label="质量">
          <el-select v-model="form.quality" multiple clearable style="width: 140px">
            <el-option label="OK" value="OK" />
            <el-option label="HOLD" value="HOLD" />
            <el-option label="NG" value="NG" />
          </el-select>
        </el-form-item>
        <el-form-item label="冻结">
          <el-select v-model="form.freeze" multiple clearable style="width: 140px">
            <el-option label="NONE" value="NONE" />
            <el-option label="FROZEN" value="FROZEN" />
          </el-select>
        </el-form-item>
        <el-form-item label="可用数">
          <el-input-number
            v-model="form.availableMin"
            :min="0"
            controls-position="right"
            style="width: 120px"
          />
          <span class="sep">-</span>
          <el-input-number
            v-model="form.availableMax"
            :min="0"
            controls-position="right"
            style="width: 120px"
          />
        </el-form-item>
        <el-form-item label="效期">
          <el-date-picker
            v-model="form.expireRange"
            type="datetimerange"
            start-placeholder="start"
            end-placeholder="end"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="runQuery">查询</el-button>
          <el-button @click="resetFilters">重置筛选</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="modeHint"
        class="hint"
        :title="modeHint"
        type="info"
        show-icon
        :closable="false"
      />
    </el-card>

    <el-card class="table-card" shadow="never">
      <div class="table-wrap">
        <template v-if="store.libraryMode === 'el-table'">
          <el-table
            v-loading="loading"
            :data="rows"
            row-key="id"
            border
            :height="tableHeight"
            :span-method="store.toggles.merge ? spanMethod : undefined"
            @sort-change="onSortChange"
          >
            <el-table-column
              v-if="store.toggles.selection"
              type="selection"
              width="50"
              fixed="left"
            />

            <template v-if="store.toggles.groupedHeader">
              <el-table-column label="货品信息">
                <ElCol
                  v-for="c in productCols"
                  :key="c.key"
                  :spec="c"
                  :toggles="store.toggles"
                  @op="onOp"
                />
              </el-table-column>
              <el-table-column label="库位信息">
                <ElCol
                  v-for="c in locationCols"
                  :key="c.key"
                  :spec="c"
                  :toggles="store.toggles"
                  @op="onOp"
                />
              </el-table-column>
              <el-table-column label="数量信息">
                <ElCol
                  v-for="c in quantityCols"
                  :key="c.key"
                  :spec="c"
                  :toggles="store.toggles"
                  @op="onOp"
                />
              </el-table-column>
              <el-table-column label="状态信息">
                <ElCol
                  v-for="c in statusCols"
                  :key="c.key"
                  :spec="c"
                  :toggles="store.toggles"
                  @op="onOp"
                />
              </el-table-column>
              <el-table-column label="周转信息">
                <ElCol
                  v-for="c in flowCols"
                  :key="c.key"
                  :spec="c"
                  :toggles="store.toggles"
                  @op="onOp"
                />
              </el-table-column>
              <el-table-column label="Meta">
                <ElCol
                  v-for="c in metaCols"
                  :key="c.key"
                  :spec="c"
                  :toggles="store.toggles"
                  @op="onOp"
                />
              </el-table-column>
              <el-table-column label="扩展">
                <ElCol
                  v-for="c in extCols"
                  :key="c.key"
                  :spec="c"
                  :toggles="store.toggles"
                  @op="onOp"
                />
              </el-table-column>
              <el-table-column label="操作">
                <ElCol
                  v-for="c in actionCols"
                  :key="c.key"
                  :spec="c"
                  :toggles="store.toggles"
                  @op="onOp"
                />
              </el-table-column>
            </template>

            <template v-else>
              <ElCol
                v-for="c in flatCols"
                :key="c.key"
                :spec="c"
                :toggles="store.toggles"
                @op="onOp"
              />
            </template>
          </el-table>
        </template>

        <template v-else>
          <el-auto-resizer>
            <template #default="{ height, width }">
              <el-table-v2
                :columns="v2Cols"
                :data="rows"
                :width="width"
                :height="height"
                :header-height="store.toggles.groupedHeader ? [40, 40] : 40"
                :sort-by="v2SortBy"
                fixed
                @column-sort="onV2ColumnSort"
              >
                <template v-if="v2Header" #header="props">
                  <component :is="v2Header" v-bind="props" />
                </template>
              </el-table-v2>
            </template>
          </el-auto-resizer>
        </template>
      </div>

      <div class="footer">
        <div class="left">
          <span>total: {{ total }}</span>
          <span class="dot">·</span>
          <span>rows: {{ rows.length }}</span>
        </div>
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          layout="prev, pager, next, sizes"
          :page-sizes="[50, 100, 200]"
          :total="total"
          @current-change="runQuery"
          @size-change="runQuery"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref, type FunctionalComponent } from 'vue'
import { ElAutoResizer, ElMessage } from 'element-plus'
import { TableV2FixedDir, TableV2SortOrder } from 'element-plus'
import type { SortBy } from 'element-plus'
import { fetchInventory } from '../mock/api'
import { getInventoryColumns } from '../columns/inventory'
import type { FilterRule, InventoryRow, Query } from '../types/benchmark'
import type { TableV2Column, TableV2HeaderCell, TableV2HeaderSlotParam } from '../types/table-v2'
import { useBenchmarkStore } from '../stores/benchmark'
import { formatDateTime, formatNumber } from '../utils/format'
import ElCol from './components/ElInventoryColumn.vue'

const store = useBenchmarkStore()

const zones = Array.from({ length: 6 }, (_, i) => `Z${String(i + 1).padStart(2, '0')}`)

const query = reactive<Query>({
  page: 1,
  pageSize: 100,
  sort: [],
  filters: [],
})

const form = reactive({
  warehouse: '' as string,
  zone: '' as string,
  keyword: '' as string,
  quality: [] as InventoryRow['qualityStatus'][],
  freeze: [] as InventoryRow['freezeStatus'][],
  availableMin: null as number | null,
  availableMax: null as number | null,
  expireRange: null as [Date, Date] | null,
})

const loading = ref(false)
const rows = ref<InventoryRow[]>([])
const total = ref(0)

const modeHint = computed(() => {
  if (store.libraryMode === 'el-table' && store.toggles.rowVirtual) {
    return 'Element Plus Table 不提供行虚拟滚动（此 Demo 通过分页作为降级）；切换到 Table V2 可观察虚拟滚动表现。'
  }
  if (store.libraryMode === 'el-table-v2' && store.toggles.groupedHeader) {
    return 'Element Plus Table V2 可通过 #header 自定义实现分组表头；此 Demo 提供一个简化分组头用于对比。'
  }
  if (store.libraryMode === 'el-table-v2' && store.toggles.merge) {
    return 'Element Plus Table V2 不支持单元格合并（merge）。'
  }
  return null
})

const tableHeight = computed(() => 'calc(100vh - 340px)')

const allCols = computed(() => getInventoryColumns(store.columnSize))

const flatCols = computed(() => {
  const cols = allCols.value
  if (!store.toggles.fixedCols) return cols.map((c) => ({ ...c, fixed: undefined }))
  return cols
})

const productCols = computed(() =>
  flatCols.value.filter((c) => ['sku', 'skuName', 'batch', 'owner', 'supplier'].includes(c.key)),
)
const locationCols = computed(() =>
  flatCols.value.filter((c) => ['warehouse', 'zone', 'bin'].includes(c.key)),
)
const quantityCols = computed(() =>
  flatCols.value.filter((c) =>
    ['onHand', 'available', 'reserved', 'damaged', 'frozen'].includes(c.key),
  ),
)
const statusCols = computed(() =>
  flatCols.value.filter((c) =>
    ['qualityStatus', 'freezeStatus', 'abcClass', 'riskLevel'].includes(c.key),
  ),
)
const flowCols = computed(() =>
  flatCols.value.filter((c) => ['inboundAt', 'lastMoveAt', 'expireAt'].includes(c.key)),
)
const metaCols = computed(() => flatCols.value.filter((c) => ['id'].includes(c.key)))
const actionCols = computed(() =>
  flatCols.value.filter((c) => ['opView', 'opCopySku'].includes(c.key)),
)
const extCols = computed(() => flatCols.value.filter((c) => String(c.key).startsWith('ext')))

function buildFilters(): FilterRule[] {
  const filters: FilterRule[] = []
  if (form.warehouse) filters.push({ field: 'warehouse', op: 'enumIn', value: [form.warehouse] })
  if (form.zone) filters.push({ field: 'zone', op: 'enumIn', value: [form.zone] })
  if (form.keyword) {
    filters.push({ field: 'sku', op: 'textContains', value: form.keyword })
    filters.push({ field: 'skuName', op: 'textContains', value: form.keyword })
  }
  if (form.quality.length)
    filters.push({ field: 'qualityStatus', op: 'enumIn', value: form.quality })
  if (form.freeze.length) filters.push({ field: 'freezeStatus', op: 'enumIn', value: form.freeze })
  if (form.availableMin != null || form.availableMax != null) {
    filters.push({
      field: 'available',
      op: 'numberRange',
      value: [form.availableMin, form.availableMax],
    })
  }
  if (form.expireRange) {
    filters.push({
      field: 'expireAt',
      op: 'dateRange',
      value: [form.expireRange[0].toISOString(), form.expireRange[1].toISOString()],
    })
  }
  return filters
}

async function runQuery() {
  loading.value = true
  try {
    query.filters = buildFilters()
    const res = await fetchInventory({
      query,
      seed: store.seed,
      size: store.dataSize,
      columnSize: store.columnSize,
      mode: store.dataMode,
    })
    rows.value = res.rows
    total.value = res.total
    store.setPerf({
      lastRequestMs: res.requestMs,
      lastComputeMs: res.computeMs,
      lastRenderNote: modeHint.value,
    })
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  form.warehouse = ''
  form.zone = ''
  form.keyword = ''
  form.quality = []
  form.freeze = []
  form.availableMin = null
  form.availableMax = null
  form.expireRange = null
  query.page = 1
  query.sort = []
  runQuery()
}

function onSortChange(e: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!e.order) query.sort = []
  else query.sort = [{ field: e.prop, order: e.order === 'ascending' ? 'asc' : 'desc' }]
  query.page = 1
  runQuery()
}

function computeMergeSpans(data: InventoryRow[]) {
  const spans = new Map<number, number>()
  let i = 0
  while (i < data.length) {
    const k = `${data[i]!.sku}|${data[i]!.batch}`
    let j = i + 1
    while (j < data.length && `${data[j]!.sku}|${data[j]!.batch}` === k) j++
    spans.set(i, j - i)
    i = j
  }
  return spans
}

const mergeSpans = computed(() =>
  store.toggles.merge ? computeMergeSpans(rows.value) : new Map<number, number>(),
)

function spanMethod({ rowIndex, column }: { rowIndex: number; column: { property?: string } }) {
  const prop = column.property
  if (!prop) return { rowspan: 1, colspan: 1 }
  if (!['sku', 'skuName', 'batch'].includes(prop)) return { rowspan: 1, colspan: 1 }
  const span = mergeSpans.value.get(rowIndex)
  if (span != null) return { rowspan: span, colspan: 1 }
  return { rowspan: 0, colspan: 0 }
}

async function onOp(op: 'view' | 'copy', row: InventoryRow) {
  if (op === 'view') {
    ElMessage.info(`查看：${row.sku} / ${row.batch}`)
    return
  }
  await navigator.clipboard.writeText(row.sku)
  ElMessage.success('已复制 SKU')
}

const v2SortBy = ref<SortBy | undefined>(undefined)

function syncV2SortBy() {
  const s = query.sort[0]
  if (!s) {
    v2SortBy.value = undefined
    return
  }
  v2SortBy.value = {
    key: s.field,
    order: s.order === 'asc' ? TableV2SortOrder.ASC : TableV2SortOrder.DESC,
  }
}

function onV2ColumnSort(sortBy: SortBy) {
  if (!sortBy.key || !sortBy.order) {
    query.sort = []
    v2SortBy.value = undefined
  } else {
    query.sort = [
      { field: String(sortBy.key), order: sortBy.order === TableV2SortOrder.ASC ? 'asc' : 'desc' },
    ]
    v2SortBy.value = sortBy
  }
  query.page = 1
  runQuery()
}

const v2Cols = computed<TableV2Column<InventoryRow>[]>(() => {
  const cols: TableV2Column<InventoryRow>[] = []
  if (store.toggles.selection) {
    cols.push({
      key: '__sel',
      dataKey: '__sel',
      title: '',
      width: 48,
      cellRenderer: () => '',
      headerCellRenderer: () => '',
      fixed: store.toggles.fixedCols ? TableV2FixedDir.LEFT : undefined,
    })
  }

  const specs = flatCols.value
  for (const s of specs) {
    cols.push({
      key: s.key,
      dataKey: s.key,
      title: s.title,
      width: s.width,
      align:
        s.align ??
        (typeof s.key === 'string' &&
        ['onHand', 'available', 'reserved', 'damaged', 'frozen'].includes(s.key)
          ? 'right'
          : 'left'),
      fixed:
        store.toggles.fixedCols && s.fixed
          ? s.fixed === 'left'
            ? TableV2FixedDir.LEFT
            : TableV2FixedDir.RIGHT
          : undefined,
      sortable: ['available', 'onHand', 'expireAt', 'riskLevel'].includes(String(s.key)),
      cellRenderer: ({ rowData }: { rowData: InventoryRow }) => {
        const k = String(s.key)
        if (k === 'qualityStatus') return rowData.qualityStatus
        if (k === 'freezeStatus') return rowData.freezeStatus
        if (k === 'abcClass') return rowData.abcClass
        if (k === 'riskLevel') return `L${rowData.riskLevel}`
        if (k.endsWith('At') || k === 'expireAt')
          return formatDateTime(asIsoString(getRowValue(rowData, k)))
        if (k === 'opView') return '查看'
        if (k === 'opCopySku') return '复制'
        const v = getRowValue(rowData, k)
        if (typeof v === 'number') return formatNumber(v)
        return String(v ?? '')
      },
    })
  }
  return cols
})

const v2Header = computed<FunctionalComponent<TableV2HeaderSlotParam> | undefined>(() => {
  if (!store.toggles.groupedHeader) return undefined
  const groups = [
    {
      label: '货品信息',
      match: (k: string) => ['sku', 'skuName', 'batch', 'owner', 'supplier'].includes(k),
    },
    { label: '库位信息', match: (k: string) => ['warehouse', 'zone', 'bin'].includes(k) },
    {
      label: '数量信息',
      match: (k: string) => ['onHand', 'available', 'reserved', 'damaged', 'frozen'].includes(k),
    },
    {
      label: '状态信息',
      match: (k: string) => ['qualityStatus', 'freezeStatus', 'abcClass', 'riskLevel'].includes(k),
    },
    {
      label: '周转信息',
      match: (k: string) => ['inboundAt', 'lastMoveAt', 'expireAt'].includes(k),
    },
    { label: 'Meta', match: (k: string) => ['id'].includes(k) },
    { label: '扩展', match: (k: string) => k.startsWith('ext') },
    { label: '操作', match: (k: string) => k.startsWith('op') },
  ]

  return (props) => {
    const { cells, columns, headerIndex } = props
    if (headerIndex === 1) return cells

    const groupCells: unknown[] = []
    let width = 0

    const flush = (label: string, lastCell: TableV2HeaderCell | undefined) => {
      groupCells.push(
        h(
          'div',
          {
            class: 'v2-group-cell',
            role: 'columnheader',
            style: { ...(lastCell?.props?.style ?? {}), width: `${width}px` },
          },
          label,
        ),
      )
      width = 0
    }

    let currentLabel = ''
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      if (!col) continue
      const cell = cells[i]
      const key = String(col.dataKey ?? col.key ?? '')
      const g = groups.find((x) => x.match(key))
      const label = key === '__sel' ? '' : (g?.label ?? '')
      if (i === 0) currentLabel = label

      width += Number(cell?.props?.column?.width ?? col.width ?? 0)

      const next = columns[i + 1]
      const nextKey = next ? String(next.dataKey ?? next.key ?? '') : ''
      const nextLabel =
        nextKey === '__sel' ? '' : (groups.find((x) => x.match(nextKey))?.label ?? '')
      if (i === columns.length - 1 || nextLabel !== currentLabel) {
        flush(currentLabel, cell)
        currentLabel = nextLabel
      }
    }

    return groupCells
  }
})

syncV2SortBy()
runQuery()

function getRowValue(row: InventoryRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key]
}

function asIsoString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
</script>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sep {
  margin: 0 6px;
  color: var(--el-text-color-secondary);
}

.hint {
  margin-top: 10px;
}

.table-card {
  overflow: hidden;
}

.table-wrap {
  height: calc(100vh - 300px);
}

.footer {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.left {
  color: var(--el-text-color-secondary);
}

.dot {
  margin: 0 8px;
}

.v2-group-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-right: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);
}
</style>
