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
        <template v-if="store.libraryMode === 'el-table'">
          <el-table
            v-loading="loading"
            :data="rows"
            row-key="id"
            border
            :height="tableHeight"
            @sort-change="onSortChange"
          >
            <el-table-column
              v-if="store.toggles.selection"
              type="selection"
              width="50"
              fixed="left"
            />
            <el-table-column
              prop="type"
              label="异常类型"
              width="140"
              fixed="left"
              align="center"
              sortable
            >
              <template #default="{ row }">
                <el-tag size="small" :type="typeTag(row.type)">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="sku"
              label="SKU"
              width="140"
              fixed="left"
              sortable
              show-overflow-tooltip
            />
            <el-table-column prop="skuName" label="名称" width="220" show-overflow-tooltip />
            <el-table-column prop="bin" label="库位" width="140" show-overflow-tooltip />
            <el-table-column prop="riskLevel" label="风险" width="110" align="center" sortable>
              <template #default="{ row }">
                <span class="risk" :data-level="row.riskLevel">L{{ row.riskLevel }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="140" align="center" sortable>
              <template #default="{ row }">
                <el-tag
                  size="small"
                  :type="
                    row.status === 'DONE'
                      ? 'success'
                      : row.status === 'PROCESSING'
                        ? 'warning'
                        : 'info'
                  "
                >
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="assignee" label="处理人" width="140" />
            <el-table-column prop="createdAt" label="创建时间" width="170" sortable>
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column prop="message" label="描述" width="320" show-overflow-tooltip />
            <el-table-column label="操作" width="280" fixed="right" align="center">
              <template #default="{ row }">
                <el-button size="small" @click="act('process', row)">标记处理中</el-button>
                <el-button size="small" @click="act('assign', row)">转派</el-button>
                <el-button size="small" @click="act('create-adjustment', row)"
                  >生成调整单</el-button
                >
                <el-button size="small" type="primary" @click="openDetail(row)">查看详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else>
          <el-auto-resizer>
            <template #default="{ height, width }">
              <el-table-v2 :columns="v2Cols" :data="rows" :height="height" :width="width" fixed />
            </template>
          </el-auto-resizer>
        </template>
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
      <template #default>
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
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue'
import { ElAutoResizer, ElMessage, ElTag } from 'element-plus'
import { TableV2FixedDir } from 'element-plus'
import { exceptionAction, fetchExceptionTimeline, fetchExceptions } from '../mock/api'
import { useBenchmarkStore } from '../stores/benchmark'
import type { ExceptionRow, FilterRule, Query } from '../types/benchmark'
import { formatDateTime } from '../utils/format'

const store = useBenchmarkStore()

const query = reactive<Query>({ page: 1, pageSize: 50, sort: [], filters: [] })
const form = reactive({
  types: [] as ExceptionRow['type'][],
  status: [] as ExceptionRow['status'][],
  keyword: '',
})

const loading = ref(false)
const rows = ref<ExceptionRow[]>([])
const total = ref(0)

const drawerOpen = ref(false)
const current = ref<ExceptionRow | null>(null)
const timelineLoading = ref(false)
const timeline = ref<{ at: string; text: string }[]>([])

const tableHeight = computed(() => 'calc(100vh - 300px)')

const modeHint = computed(() => {
  if (store.libraryMode === 'el-table-v2')
    return 'Table V2：此页重点对比“固定列 + 高频操作 + Drawer”。Table V2 列固定能力有限，作为体验对比即可。'
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

function onSortChange(e: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!e.order) query.sort = []
  else query.sort = [{ field: e.prop, order: e.order === 'ascending' ? 'asc' : 'desc' }]
  query.page = 1
  runQuery()
}

function typeTag(t: ExceptionRow['type']) {
  if (t === 'SHORT') return 'danger'
  if (t === 'EXPIRE_RISK') return 'warning'
  if (t === 'FROZEN') return 'info'
  return undefined
}

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

const v2Cols = computed(() => [
  {
    key: 'type',
    dataKey: 'type',
    title: '异常类型',
    width: 140,
    fixed: store.toggles.fixedCols ? TableV2FixedDir.LEFT : undefined,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: ExceptionRow }) =>
      h(ElTag, { type: typeTag(rowData.type), size: 'small' }, () => rowData.type),
  },
  {
    key: 'sku',
    dataKey: 'sku',
    title: 'SKU',
    width: 140,
    fixed: store.toggles.fixedCols ? TableV2FixedDir.LEFT : undefined,
  },
  { key: 'skuName', dataKey: 'skuName', title: '名称', width: 220 },
  { key: 'bin', dataKey: 'bin', title: '库位', width: 140 },
  {
    key: 'riskLevel',
    dataKey: 'riskLevel',
    title: '风险',
    width: 110,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: ExceptionRow }) => `L${rowData.riskLevel}`,
  },
  {
    key: 'status',
    dataKey: 'status',
    title: '状态',
    width: 140,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: ExceptionRow }) => rowData.status,
  },
  { key: 'assignee', dataKey: 'assignee', title: '处理人', width: 140 },
  {
    key: 'createdAt',
    dataKey: 'createdAt',
    title: '创建时间',
    width: 170,
    cellRenderer: ({ rowData }: { rowData: ExceptionRow }) => formatDateTime(rowData.createdAt),
  },
  { key: 'message', dataKey: 'message', title: '描述', width: 320 },
  {
    key: 'op',
    dataKey: 'op',
    title: '操作',
    width: 260,
    fixed: store.toggles.fixedCols ? TableV2FixedDir.RIGHT : undefined,
    cellRenderer: ({ rowData }: { rowData: ExceptionRow }) =>
      h('div', { style: { display: 'flex', gap: '8px' } }, [
        h('a', { style: linkStyle, onClick: () => act('process', rowData) }, '处理中'),
        h('a', { style: linkStyle, onClick: () => act('assign', rowData) }, '转派'),
        h('a', { style: linkStyle, onClick: () => act('create-adjustment', rowData) }, '调整单'),
        h('a', { style: linkStyle, onClick: () => openDetail(rowData) }, '详情'),
      ]),
  },
])

const linkStyle = { color: 'var(--el-color-primary)', cursor: 'pointer', textDecoration: 'none' }

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
