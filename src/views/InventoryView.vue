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
      <div class="table-tools">
        <ColumnSettings
          :columns="baseColumns"
          v-model:order="columnOrder"
          v-model:visibility="columnVisibility"
          :support-text="columnSupport"
        />
      </div>
      <div class="table-wrap">
        <component
          :is="adapter.DataTable"
          :rows="rows"
          row-key="id"
          :height="tableHeight"
          :loading="loading"
          border
          :columns="columns"
          :header-groups="headerGroups"
          :selection="store.toggles.selection && adapter.capabilities.selection"
          :selected-row-keys="selectedRowKeys"
          :on-update-selected-row-keys="onUpdateSelectedKeys"
          :sort="tableSort"
          :on-update-sort="onUpdateSort"
          :span-method="spanMethod"
          empty-text="暂无数据"
        />
      </div>

      <div class="footer">
        <div class="left">
          <span>total: {{ total }}</span>
          <span class="dot">·</span>
          <span>rows: {{ rows.length }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  ElAlert,
  ElButton,
  ElCard,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
} from 'element-plus'
import { fetchInventory } from '../mock/api'
import { getInventoryColumns } from '../columns/inventory'
import type { FilterRule, InventoryRow, Query } from '../types/benchmark'
import { useBenchmarkStore } from '../stores/benchmark'
import { useTableAdapter } from '../adapters/table/useTableAdapter'
import { buildInventoryColumns } from '../columns/inventoryColumns'
import type { TableColumnDef, TableHeaderGroup, TableSortRule } from '../adapters/table/types'
import ColumnSettings from '../components/ColumnSettings.vue'
import {
  applyColumnSettingsToGroups,
  getColumnSupportText,
  useColumnSettings,
} from '../utils/columnSettings'

const store = useBenchmarkStore()
const adapter = useTableAdapter()

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
const selectedRowKeys = ref<string[]>([])

const modeHint = computed(() => {
  const hints: string[] = []

  if (store.libraryMode === 'el-table' && store.toggles.rowVirtual) {
    hints.push(
      'Element Plus Table 未提供可接管表体渲染的入口，无法直接接入 @tanstack/virtual；虚拟化请切换到官方 Table V2。',
    )
  }
  if (store.libraryMode === 'el-table-v2' && store.toggles.merge) {
    hints.push(
      'Element Plus Table V2 虽然支持合并，但是实现起来有很多坑，比如复杂的单元格合并，合并时的hover效果好像都不太好处理。',
    )
  }
  if (store.libraryMode === 'ant-table' && store.toggles.rowVirtual) {
    hints.push(
      'Ant Design Vue Table 文档未提供可替换 body/row 的渲染入口，难以接入 @tanstack/virtual；需分页或自建虚拟表格壳。',
    )
  }
  if (store.libraryMode === 'ant-table' && store.toggles.merge) {
    hints.push('Ant Design Vue Table 已通过 customCell + rowSpan/colSpan 实现单元格合并。')
  }
  if (store.libraryMode === 'tanstack-table' && store.toggles.rowVirtual) {
    hints.push('TanStack Table 已接入 @tanstack/virtual，实现行虚拟滚动。')
  }
  if (store.libraryMode === 'tanstack-table' && store.toggles.merge) {
    hints.push('TanStack Table 已通过 spanMethod + rowSpan/colSpan 实现单元格合并。')
  }
  if (store.libraryMode === 'ag-grid' && store.toggles.rowVirtual) {
    hints.push('AG Grid Community 内置行虚拟化（窗口渲染），无需额外接入虚拟库。')
  }

  if (store.libraryMode === 'el-table') {
    hints.push('列筛选：仅内建列表过滤(filters)，输入/日期/自定义需自行实现。')
  }
  if (store.libraryMode === 'el-table-v2') {
    hints.push('列筛选：无内建过滤面板，示例通过自定义表头实现输入/选择/日期/自定义。')
  }
  if (store.libraryMode === 'ant-table') {
    hints.push('列筛选：内建 filters + filterDropdown，自定义面板示例已启用。')
  }
  if (store.libraryMode === 'vxe-table') {
    hints.push('列筛选：内建 filters + filterRender，自定义筛选示例已启用。')
  }
  if (store.libraryMode === 'ag-grid') {
    hints.push('列筛选：内建文本/集合/日期/数值过滤；自定义组件需另实现。')
  }
  if (store.libraryMode === 'tanstack-table') {
    hints.push('列筛选：TanStack Table 方案暂未实现（后续补充）。')
  }

  return hints.length ? hints.join('；') : null
})

const tableHeight = computed(() => 'calc(100vh - 340px)')
const columnSupport = computed(() => getColumnSupportText(store.libraryMode))

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
    query.page = 1
    query.pageSize = store.dataSize
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

const specs = computed(() => {
  const cols = getInventoryColumns(store.columnSize)
  if (!store.toggles.fixedCols) return cols.map((c) => ({ ...c, fixed: undefined }))
  return cols
})

const baseColumns = computed<TableColumnDef<InventoryRow>[]>(() =>
  buildInventoryColumns(specs.value),
)
const columnSettings = useColumnSettings(baseColumns)
const columnOrder = columnSettings.order
const columnVisibility = columnSettings.visibility

const columns = computed<TableColumnDef<InventoryRow>[]>(() => columnSettings.visibleColumns.value)

const headerGroups = computed<TableHeaderGroup<InventoryRow>[] | undefined>(() => {
  if (!store.toggles.groupedHeader) return undefined
  const group = (title: string, keys: string[]) => ({
    title,
    columns: baseColumns.value.filter((c) => keys.includes(c.key)),
  })
  const ext = baseColumns.value.filter((c) => c.key.startsWith('ext'))
  const ops = baseColumns.value.filter((c) => c.key.startsWith('op'))

  const groups = [
    group('货品信息', ['sku', 'skuName', 'batch', 'owner', 'supplier']),
    group('库位信息', ['warehouse', 'zone', 'bin']),
    group('数量信息', ['onHand', 'available', 'reserved', 'damaged', 'frozen']),
    group('状态信息', ['qualityStatus', 'freezeStatus', 'abcClass', 'riskLevel']),
    group('周转信息', ['inboundAt', 'lastMoveAt', 'expireAt']),
    group('Meta', ['id']),
    { title: '扩展', columns: ext },
    { title: '操作', columns: ops },
  ].filter((g) => g.columns.length)

  return applyColumnSettingsToGroups(groups, columnOrder.value, columnVisibility.value)
})

function onUpdateSelectedKeys(keys: string[]) {
  selectedRowKeys.value = keys
}

const tableSort = computed<TableSortRule[]>(() =>
  query.sort.map((s) => ({ key: s.field, order: s.order })),
)

function onUpdateSort(sort: TableSortRule[]) {
  query.sort = sort.map((s) => ({ field: s.key, order: s.order }))
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

const spanMethod = computed(() => {
  if (!store.toggles.merge || !adapter.value.capabilities.mergeCells) return undefined
  return ({ rowIndex, columnKey }: { row: InventoryRow; rowIndex: number; columnKey: string }) => {
    if (!['sku', 'skuName', 'batch'].includes(columnKey)) return { rowspan: 1, colspan: 1 }
    const span = mergeSpans.value.get(rowIndex)
    if (span != null) return { rowspan: span, colspan: 1 }
    return { rowspan: 0, colspan: 0 }
  }
})

runQuery()
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

.table-tools {
  margin-bottom: 10px;
  display: flex;
  justify-content: flex-end;
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

:deep(.tb-skin) {
  .link {
    color: var(--el-color-primary);
    cursor: pointer;
    text-decoration: none;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 10px;
    border: 1px solid var(--el-border-color);
    font-size: 12px;
    line-height: 18px;
  }

  .tag-ok {
    color: var(--el-color-success);
    border-color: var(--el-color-success-light-5);
    background: var(--el-color-success-light-9);
  }

  .tag-hold {
    color: var(--el-color-warning);
    border-color: var(--el-color-warning-light-5);
    background: var(--el-color-warning-light-9);
  }

  .tag-ng {
    color: var(--el-color-danger);
    border-color: var(--el-color-danger-light-5);
    background: var(--el-color-danger-light-9);
  }

  .tag-warn {
    color: var(--el-color-warning);
    border-color: var(--el-color-warning-light-5);
    background: var(--el-color-warning-light-9);
  }

  .tag-info {
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  .num.warn {
    color: var(--el-color-danger);
    font-weight: 600;
  }

  .risk[data-level='5'] {
    color: var(--el-color-danger);
    font-weight: 700;
  }

  .risk[data-level='4'] {
    color: var(--el-color-warning);
    font-weight: 700;
  }
}
</style>
