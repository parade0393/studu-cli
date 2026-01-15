<template>
  <div class="view">
    <el-card shadow="never">
      <el-form :inline="true" label-width="70px" size="small">
        <el-form-item label="类型">
          <el-select v-model="form.types" multiple clearable style="width: 200px">
            <el-option label="SHORT" value="SHORT" />
            <el-option label="EXPIRE_RISK" value="EXPIRE_RISK" />
            <el-option label="FROZEN" value="FROZEN" />
            <el-option label="COUNT_DIFF" value="COUNT_DIFF" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" multiple clearable style="width: 200px">
            <el-option label="OPEN" value="OPEN" />
            <el-option label="PROCESSING" value="PROCESSING" />
            <el-option label="DONE" value="DONE" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="form.keyword" clearable placeholder="sku/名称" style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="runQuery">查询</el-button>
          <el-button @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-alert
        v-if="modeHint"
        class="hint"
        :title="modeHint"
        type="info"
        show-icon
        :closable="false"
      />

      <div class="table-wrap">
        <component
          :is="adapter.DataTable"
          :rows="rows"
          row-key="id"
          :height="tableHeight"
          :loading="loading"
          border
          :columns="columns"
          :header-groups="undefined"
          :selection="store.toggles.selection && adapter.capabilities.selection"
          :selected-row-keys="selectedRowKeys"
          :on-update-selected-row-keys="onUpdateSelectedKeys"
          :sort="tableSort"
          :on-update-sort="onUpdateSort"
          empty-text="暂无数据"
        />
      </div>

      <div class="footer">
        <div class="left">total: {{ total }} · rows: {{ rows.length }}</div>
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          layout="prev, pager, next, sizes"
          :page-sizes="[20, 50, 100]"
          :total="total"
          @current-change="runQuery"
          @size-change="runQuery"
        />
      </div>
    </el-card>

    <el-drawer v-model="drawerOpen" title="异常详情" size="420px">
      <el-descriptions v-if="current" :column="1" size="small" border>
        <el-descriptions-item label="type">{{ current.type }}</el-descriptions-item>
        <el-descriptions-item label="sku">{{ current.sku }}</el-descriptions-item>
        <el-descriptions-item label="skuName">{{ current.skuName }}</el-descriptions-item>
        <el-descriptions-item label="bin">{{ current.bin }}</el-descriptions-item>
        <el-descriptions-item label="status">{{ current.status }}</el-descriptions-item>
        <el-descriptions-item label="message">{{ current.message }}</el-descriptions-item>
      </el-descriptions>

      <el-divider />
      <div class="tl-title">操作日志</div>
      <el-timeline v-loading="timelineLoading">
        <el-timeline-item v-for="(t, i) in timeline" :key="i" :timestamp="formatDateTime(t.at)">
          {{ t.text }}
        </el-timeline-item>
      </el-timeline>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref, type FunctionalComponent } from 'vue'
import {
  ElAlert,
  ElButton,
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElDivider,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus'
import { exceptionAction, fetchExceptionTimeline, fetchExceptions } from '../mock/api'
import { useBenchmarkStore } from '../stores/benchmark'
import type { ExceptionRow, FilterRule, Query } from '../types/benchmark'
import { formatDateTime } from '../utils/format'
import { useTableAdapter } from '../adapters/table/useTableAdapter'
import type {
  TableCellCtx,
  TableColumnDef,
  TableFixed,
  TableSortRule,
} from '../adapters/table/types'

const store = useBenchmarkStore()
const adapter = useTableAdapter()

const query = reactive<Query>({ page: 1, pageSize: 50, sort: [], filters: [] })
const form = reactive({
  types: [] as ExceptionRow['type'][],
  status: [] as ExceptionRow['status'][],
  keyword: '',
})

const loading = ref(false)
const rows = ref<ExceptionRow[]>([])
const total = ref(0)
const selectedRowKeys = ref<string[]>([])

const drawerOpen = ref(false)
const current = ref<ExceptionRow | null>(null)
const timelineLoading = ref(false)
const timeline = ref<{ at: string; text: string }[]>([])

const tableHeight = computed(() => 'calc(100vh - 300px)')

const modeHint = computed(() => {
  if (store.libraryMode === 'el-table-v2')
    return 'Table V2：此页重点对比“固定列 + 高频操作 + Drawer”。'
  return null
})

function buildFilters(): FilterRule[] {
  const filters: FilterRule[] = []
  if (form.types.length) filters.push({ field: 'type', op: 'enumIn', value: form.types })
  if (form.status.length) filters.push({ field: 'status', op: 'enumIn', value: form.status })
  if (form.keyword.trim()) {
    filters.push({ field: 'sku', op: 'textContains', value: form.keyword })
    filters.push({ field: 'skuName', op: 'textContains', value: form.keyword })
  }
  return filters
}

async function runQuery() {
  loading.value = true
  try {
    query.filters = buildFilters()
    const res = await fetchExceptions({
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

function reset() {
  form.types = []
  form.status = []
  form.keyword = ''
  query.page = 1
  query.sort = []
  runQuery()
}

const tableSort = computed<TableSortRule[]>(() =>
  query.sort.map((s) => ({ key: s.field, order: s.order })),
)
function onUpdateSort(sort: TableSortRule[]) {
  query.sort = sort.map((s) => ({ field: s.key, order: s.order }))
  query.page = 1
  runQuery()
}

function onUpdateSelectedKeys(keys: string[]) {
  selectedRowKeys.value = keys
}

function typeColor(t: ExceptionRow['type']): 'danger' | 'warning' | 'info' | 'default' {
  if (t === 'SHORT') return 'danger'
  if (t === 'EXPIRE_RISK') return 'warning'
  if (t === 'FROZEN') return 'info'
  return 'default'
}

function fixedIf(enabled: boolean, dir: TableFixed): TableFixed | undefined {
  return enabled ? dir : undefined
}

const columns = computed<TableColumnDef<ExceptionRow>[]>(() => {
  const link = (text: string, onClick: () => void) => h('a', { class: 'link', onClick }, text)
  const fixedLeft = store.toggles.fixedCols ? 'left' : undefined
  const fixedRight = store.toggles.fixedCols ? 'right' : undefined

  const typeCell: FunctionalComponent<TableCellCtx<ExceptionRow>> = ({ row }) =>
    h('span', { class: `tag tag-${typeColor(row.type)}` }, row.type)

  const statusCell: FunctionalComponent<TableCellCtx<ExceptionRow>> = ({ row }) =>
    h(
      'span',
      {
        class: `tag tag-${row.status === 'DONE' ? 'success' : row.status === 'PROCESSING' ? 'warning' : 'info'}`,
      },
      row.status,
    )

  const riskCell: FunctionalComponent<TableCellCtx<ExceptionRow>> = ({ row }) =>
    h('span', { class: 'risk', 'data-level': row.riskLevel }, `L${row.riskLevel}`)

  const opsCell: FunctionalComponent<TableCellCtx<ExceptionRow>> = ({ row }) =>
    h('div', { class: 'ops' }, [
      link('处理中', () => act('process', row)),
      link('转派', () => act('assign', row)),
      link('调整单', () => act('create-adjustment', row)),
      link('详情', () => openDetail(row)),
    ])

  return [
    {
      key: 'type',
      title: '异常类型',
      width: 140,
      align: 'center',
      fixed: fixedLeft,
      sortable: true,
      cell: typeCell,
    },
    {
      key: 'sku',
      title: 'SKU',
      width: 140,
      fixed: fixedIf(store.toggles.fixedCols, 'left'),
      sortable: true,
    },
    { key: 'skuName', title: '名称', width: 220 },
    { key: 'bin', title: '库位', width: 140, sortable: true },
    {
      key: 'riskLevel',
      title: '风险',
      width: 110,
      align: 'center',
      sortable: true,
      cell: riskCell,
    },
    { key: 'status', title: '状态', width: 140, align: 'center', sortable: true, cell: statusCell },
    { key: 'assignee', title: '处理人', width: 140 },
    {
      key: 'createdAt',
      title: '创建时间',
      width: 170,
      sortable: true,
      valueGetter: (r) => formatDateTime(r.createdAt),
    },
    { key: 'message', title: '描述', width: 320 },
    { key: 'op', title: '操作', width: 260, fixed: fixedRight, cell: opsCell },
  ]
})

async function act(action: 'process' | 'assign' | 'create-adjustment', row: ExceptionRow) {
  const res = await exceptionAction({ seed: store.seed, action, id: row.id })
  if (res.ok) ElMessage.success('操作成功')
  else ElMessage.error(res.message ?? '操作失败')
}

async function openDetail(row: ExceptionRow) {
  current.value = row
  drawerOpen.value = true
  timelineLoading.value = true
  try {
    timeline.value = await fetchExceptionTimeline({ seed: store.seed, id: row.id })
  } finally {
    timelineLoading.value = false
  }
}

runQuery()
</script>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-wrap {
  height: calc(100vh - 260px);
}

.footer {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.left {
  color: var(--el-text-color-secondary);
}

.hint {
  margin-bottom: 10px;
}

.link {
  color: var(--el-color-primary);
  cursor: pointer;
  text-decoration: none;
}

.ops {
  display: inline-flex;
  gap: 8px;
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

.tag-danger {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-5);
}

.tag-warning {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-5);
}

.tag-info {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.tag-success {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-5);
}

.risk[data-level='5'] {
  color: var(--el-color-danger);
  font-weight: 700;
}

.risk[data-level='4'] {
  color: var(--el-color-warning);
  font-weight: 700;
}

.tl-title {
  font-weight: 700;
  margin-bottom: 10px;
}
</style>
