<template>
  <div class="view">
    <el-card shadow="never">
      <el-form :inline="true" size="small">
        <el-form-item label="关键字">
          <el-input v-model="leftKeyword" clearable placeholder="sku/名称" style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="leftLoading" @click="loadLeft">查询左表</el-button>
          <el-button @click="resetLeft">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <div class="grid">
        <div class="panel">
          <div class="panel-title">可拣库存（左表）</div>
          <el-alert
            v-if="leftHint"
            class="hint"
            :title="leftHint"
            type="info"
            show-icon
            :closable="false"
          />

          <div class="table-wrap">
            <component
              :is="adapter.DataTable"
              :rows="leftRows"
              row-key="id"
              :height="tableHeight"
              :loading="leftLoading"
              border
              :columns="leftColumns"
              :selection="store.toggles.selection && adapter.capabilities.selection"
              :selected-row-keys="leftSelectedKeys"
              :on-update-selected-row-keys="onUpdateLeftSelectedKeys"
              :sort="[]"
              :on-update-sort="undefined"
              empty-text="暂无数据"
            />
          </div>
        </div>

        <div class="actions">
          <el-button
            type="primary"
            :disabled="leftSelectedRows.length === 0"
            @click="generateLines"
          >
            生成拣货行 &gt;&gt;
          </el-button>
          <el-button :disabled="rightSelectedKeys.length === 0" @click="removeSelected">
            &lt;&lt; 移除选中
          </el-button>
          <el-divider />
          <el-button :disabled="rightSelectedKeys.length === 0" @click="openBatchPicker"
            >批量设置 picker</el-button
          >
          <el-button :disabled="rightSelectedKeys.length === 0" @click="openBatchStrategy"
            >批量设置 strategy</el-button
          >
          <el-button :disabled="rightLines.length === 0" @click="validateAll"
            >触发全量校验</el-button
          >
          <el-divider />
          <el-button
            type="success"
            :disabled="readyCount === 0"
            :loading="submitting"
            @click="submitReady"
          >
            提交 ready 行
          </el-button>
        </div>

        <div class="panel">
          <div class="panel-title">拣货明细（右表：强编辑）</div>
          <el-alert
            v-if="rightHint"
            class="hint"
            :title="rightHint"
            type="info"
            show-icon
            :closable="false"
          />

          <div class="table-wrap">
            <component
              :is="adapter.DataTable"
              :rows="rightLines"
              row-key="lineId"
              :height="tableHeight"
              border
              :columns="rightColumns"
              :selection="store.toggles.selection && adapter.capabilities.selection"
              :selected-row-keys="rightSelectedKeys"
              :on-update-selected-row-keys="onUpdateRightSelectedKeys"
              :sort="[]"
              :on-update-sort="undefined"
              empty-text="暂无数据"
            />
          </div>
        </div>
      </div>

      <div class="summary">
        <span>错误行：{{ errorCount }}</span>
        <span class="dot">·</span>
        <span>待提交(ready)：{{ readyCount }}</span>
        <span class="dot">·</span>
        <span>pickQty 合计：{{ pickQtySum }}</span>
        <span class="dot">·</span>
        <span>最近提交耗时：{{ submitMs }}</span>
      </div>
    </el-card>

    <el-dialog v-model="batchPickerVisible" title="批量设置 picker" width="420px">
      <el-select
        v-model="batchPickerId"
        filterable
        remote
        :remote-method="remoteSearchPicker"
        :loading="pickerLoading"
        style="width: 100%"
      >
        <el-option v-for="p in pickerOptions" :key="p.id" :label="p.name" :value="p.id" />
      </el-select>
      <template #footer>
        <el-button @click="batchPickerVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!batchPickerId" @click="applyBatchPicker"
          >应用</el-button
        >
      </template>
    </el-dialog>

    <el-dialog v-model="batchStrategyVisible" title="批量设置 strategy" width="420px">
      <el-select v-model="batchStrategy" style="width: 100%">
        <el-option label="FIFO" value="FIFO" />
        <el-option label="FEFO" value="FEFO" />
        <el-option label="MANUAL" value="MANUAL" />
        <el-option label="ZONE_FIRST" value="ZONE_FIRST" />
      </el-select>
      <template #footer>
        <el-button @click="batchStrategyVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!batchStrategy" @click="applyBatchStrategy"
          >应用</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, type FunctionalComponent } from 'vue'
import { ElInput, ElInputNumber, ElMessage, ElOption, ElSelect } from 'element-plus'
import { fetchInventory, searchPickers, submitPicking, validatePicker } from '../mock/api'
import { useBenchmarkStore } from '../stores/benchmark'
import type { InventoryRow, PickLine, Picker, Query } from '../types/benchmark'
import { formatDateTime, formatNumber } from '../utils/format'
import { useTableAdapter } from '../adapters/table/useTableAdapter'
import type { TableCellCtx, TableColumnDef } from '../adapters/table/types'

const store = useBenchmarkStore()
const adapter = useTableAdapter()

const tableHeight = 'calc(100vh - 420px)'

const leftKeyword = ref('')
const leftLoading = ref(false)
const leftRows = ref<InventoryRow[]>([])
const leftSelectedKeys = ref<string[]>([])

const rightLines = ref<PickLine[]>([])
const rightSelectedKeys = ref<string[]>([])

const editing = ref(new Set<string>())
const editOrigin = ref(new Map<string, PickLine>())
const history = ref(new Map<string, PickLine[]>())
const validateToken = ref(new Map<string, number>())

const pickerLoading = ref(false)
const pickerOptions = ref<Picker[]>([])

const submitting = ref(false)
const submitMs = ref('-')

const leftSelectedRows = computed(() => {
  const set = new Set(leftSelectedKeys.value)
  return leftRows.value.filter((r) => set.has(r.id))
})

const rightSelectedRows = computed(() => {
  const set = new Set(rightSelectedKeys.value)
  return rightLines.value.filter((r) => set.has(r.lineId))
})

function onUpdateLeftSelectedKeys(keys: string[]) {
  leftSelectedKeys.value = keys
}

function onUpdateRightSelectedKeys(keys: string[]) {
  rightSelectedKeys.value = keys
}

const leftHint = computed(() => null)
const rightHint = computed(() =>
  store.libraryMode === 'el-table-v2' ? 'Table V2：重点观察编辑控件在虚拟滚动下的稳定性。' : null,
)

function makeQuery(): Query {
  return { page: 1, pageSize: 200, sort: [{ field: 'expireAt', order: 'asc' }], filters: [] }
}

async function loadLeft() {
  leftLoading.value = true
  try {
    const query = makeQuery()
    query.filters.push({ field: 'available', op: 'numberRange', value: [1, null] })
    query.filters.push({ field: 'qualityStatus', op: 'enumIn', value: ['OK'] })
    if (leftKeyword.value.trim()) {
      query.filters.push({ field: 'sku', op: 'textContains', value: leftKeyword.value })
      query.filters.push({ field: 'skuName', op: 'textContains', value: leftKeyword.value })
    }
    const res = await fetchInventory({
      query,
      seed: store.seed,
      size: Math.min(store.dataSize, 20000),
      columnSize: store.columnSize,
      mode: store.dataMode,
    })
    leftRows.value = res.rows
    store.setPerf({
      lastRequestMs: res.requestMs,
      lastComputeMs: res.computeMs,
      lastRenderNote: leftHint.value,
    })
  } finally {
    leftLoading.value = false
  }
}

function resetLeft() {
  leftKeyword.value = ''
  loadLeft()
}

function defaultPickQty(strategy: PickLine['strategy'], available: number): number | null {
  if (strategy === 'MANUAL') return null
  const suggest = strategy === 'FEFO' ? 10 : strategy === 'FIFO' ? 20 : 15
  return Math.min(available, suggest)
}

function validateSync(line: PickLine) {
  const errors: PickLine['errors'] = []
  if (line.pickQty == null || !(line.pickQty > 0))
    errors.push({ field: 'pickQty', message: 'pickQty 必填且 > 0' })
  else if (line.pickQty > line.available)
    errors.push({ field: 'pickQty', message: 'pickQty 不能超过 available' })
  if (!line.pickerId) errors.push({ field: 'pickerId', message: 'picker 必填' })

  line.errors = errors
  if (line.rowStatus === 'submitted') return
  if (errors.length) line.rowStatus = 'error'
  else if (line.rowStatus !== 'validating') line.rowStatus = 'ready'
}

function pushHistory(line: PickLine) {
  const stack = history.value.get(line.lineId) ?? []
  stack.push(structuredClone(line))
  if (stack.length > 10) stack.shift()
  history.value.set(line.lineId, stack)
}

function setField<K extends keyof PickLine>(line: PickLine, key: K, value: PickLine[K]) {
  if (line.rowStatus === 'submitted') return
  pushHistory(line)
  line[key] = value
  if (key === 'strategy') {
    if (line.pickQty == null) line.pickQty = defaultPickQty(line.strategy, line.available)
  }
  line.rowStatus = 'dirty'
  validateSync(line)
  if (key === 'pickerId') triggerValidatePicker(line)
}

function setPickQty(line: PickLine, v: number | undefined | null) {
  setField(line, 'pickQty', v ?? null)
}

async function onPickPicker(line: PickLine, pickerId: string) {
  const picker = pickerOptions.value.find((p) => p.id === pickerId)
  setField(line, 'pickerId', pickerId)
  setField(line, 'pickerName', picker?.name ?? pickerId)
}

async function triggerValidatePicker(line: PickLine) {
  if (!line.pickerId) return
  const token = (validateToken.value.get(line.lineId) ?? 0) + 1
  validateToken.value.set(line.lineId, token)
  line.rowStatus = 'validating'
  validateSync(line)
  const res = await validatePicker({
    seed: store.seed,
    pickerId: line.pickerId,
    lineId: line.lineId,
  })
  if ((validateToken.value.get(line.lineId) ?? 0) !== token) return
  if (!res.ok) {
    line.errors = [{ field: 'pickerId', message: res.message ?? 'picker 校验失败' }]
    line.rowStatus = 'error'
  } else {
    validateSync(line)
  }
}

async function remoteSearchPicker(q: string) {
  pickerLoading.value = true
  try {
    pickerOptions.value = await searchPickers({ seed: store.seed, q })
  } finally {
    pickerLoading.value = false
  }
}

function generateLines() {
  const adds = leftSelectedRows.value.map((inv) => {
    const strategy: PickLine['strategy'] = 'FEFO'
    return {
      lineId: `L-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sourceId: inv.id,
      sku: inv.sku,
      skuName: inv.skuName,
      batch: inv.batch,
      bin: inv.bin,
      available: inv.available,
      pickQty: defaultPickQty(strategy, inv.available),
      pickerId: null,
      pickerName: null,
      strategy,
      remark: '',
      rowStatus: 'dirty',
      errors: [],
    } satisfies PickLine
  })
  rightLines.value = [...adds, ...rightLines.value]
  for (const l of adds) validateSync(l)
  ElMessage.success(`已生成 ${adds.length} 行`)
}

function removeSelected() {
  const rm = new Set(rightSelectedKeys.value)
  rightLines.value = rightLines.value.filter((r) => !rm.has(r.lineId))
  rightSelectedKeys.value = []
}

function isEditing(line: PickLine) {
  return editing.value.has(line.lineId)
}

function startEdit(line: PickLine) {
  editing.value.add(line.lineId)
  editOrigin.value.set(line.lineId, structuredClone(line))
}

function saveEdit(line: PickLine) {
  editing.value.delete(line.lineId)
  editOrigin.value.delete(line.lineId)
  validateSync(line)
}

function cancelEdit(line: PickLine) {
  const origin = editOrigin.value.get(line.lineId)
  if (!origin) return
  Object.assign(line, origin)
  editing.value.delete(line.lineId)
  editOrigin.value.delete(line.lineId)
}

function canUndo(line: PickLine) {
  const stack = history.value.get(line.lineId) ?? []
  return stack.length > 0
}

function undoRow(line: PickLine) {
  const stack = history.value.get(line.lineId) ?? []
  const prev = stack.pop()
  if (!prev) return
  history.value.set(line.lineId, stack)
  Object.assign(line, prev)
  validateSync(line)
}

function statusText(line: PickLine) {
  return line.rowStatus
}

const errorCount = computed(() => rightLines.value.filter((l) => l.rowStatus === 'error').length)
const readyCount = computed(() => rightLines.value.filter((l) => l.rowStatus === 'ready').length)
const pickQtySum = computed(() => rightLines.value.reduce((s, l) => s + (l.pickQty ?? 0), 0))

function validateAll() {
  for (const l of rightLines.value) {
    if (l.rowStatus !== 'submitted') {
      l.rowStatus = 'dirty'
      validateSync(l)
      if (l.pickerId) triggerValidatePicker(l)
    }
  }
}

async function submitReady() {
  submitting.value = true
  try {
    const ready = rightLines.value.filter((l) => l.rowStatus === 'ready')
    const res = await submitPicking({ seed: store.seed, lines: ready })
    submitMs.value = `${res.requestMs.toFixed(0)}ms`
    const map = new Map(res.results.map((r) => [r.lineId, r]))
    for (const l of ready) {
      const r = map.get(l.lineId)
      if (!r) continue
      if (r.ok) {
        l.rowStatus = 'submitted'
        l.errors = []
      } else {
        l.rowStatus = 'error'
        l.errors = [{ field: 'submit', message: r.message ?? '提交失败' }]
      }
    }
  } finally {
    submitting.value = false
  }
}

const batchPickerVisible = ref(false)
const batchPickerId = ref<string>('')
function openBatchPicker() {
  batchPickerId.value = ''
  batchPickerVisible.value = true
  remoteSearchPicker('')
}
function applyBatchPicker() {
  const picker = pickerOptions.value.find((p) => p.id === batchPickerId.value)
  for (const l of rightSelectedRows.value) {
    setField(l, 'pickerId', batchPickerId.value)
    setField(l, 'pickerName', picker?.name ?? batchPickerId.value)
  }
  batchPickerVisible.value = false
}

const batchStrategyVisible = ref(false)
const batchStrategy = ref<PickLine['strategy'] | ''>('')
function openBatchStrategy() {
  batchStrategy.value = ''
  batchStrategyVisible.value = true
}
function applyBatchStrategy() {
  for (const l of rightSelectedRows.value) {
    setField(l, 'strategy', batchStrategy.value as PickLine['strategy'])
  }
  batchStrategyVisible.value = false
}

const leftColumns = computed<TableColumnDef<InventoryRow>[]>(() => [
  { key: 'sku', title: 'SKU', width: 140, fixed: store.toggles.fixedCols ? 'left' : undefined },
  {
    key: 'skuName',
    title: '名称',
    width: 220,
    fixed: store.toggles.fixedCols ? 'left' : undefined,
  },
  { key: 'batch', title: '批次', width: 140 },
  { key: 'bin', title: '库位', width: 140 },
  {
    key: 'available',
    title: '可用',
    width: 110,
    align: 'right',
    valueGetter: (r) => formatNumber(r.available),
  },
  { key: 'qualityStatus', title: '质量', width: 100, align: 'center' },
  { key: 'expireAt', title: '效期', width: 170, valueGetter: (r) => formatDateTime(r.expireAt) },
])

const rightColumns = computed<TableColumnDef<PickLine>[]>(() => {
  const link = (text: string, onClick: () => void) => h('a', { class: 'link', onClick }, text)

  const pickQtyCell: FunctionalComponent<TableCellCtx<PickLine>> = ({ row }) =>
    isEditing(row)
      ? h(ElInputNumber, {
          modelValue: row.pickQty ?? undefined,
          min: 0,
          max: row.available,
          controlsPosition: 'right',
          'onUpdate:modelValue': (v: number | undefined) => setPickQty(row, v),
        })
      : String(row.pickQty ?? '-')

  const pickerCell: FunctionalComponent<TableCellCtx<PickLine>> = ({ row }) =>
    isEditing(row)
      ? h(
          ElSelect,
          {
            modelValue: row.pickerId ?? '',
            filterable: true,
            remote: true,
            reserveKeyword: true,
            remoteMethod: remoteSearchPicker,
            loading: pickerLoading.value,
            placeholder: '搜索 picker',
            style: { width: '170px' },
            'onUpdate:modelValue': (v: string) => onPickPicker(row, String(v)),
          },
          () =>
            pickerOptions.value.map((p) => h(ElOption, { key: p.id, label: p.name, value: p.id })),
        )
      : (row.pickerName ?? '-')

  const strategyCell: FunctionalComponent<TableCellCtx<PickLine>> = ({ row }) =>
    isEditing(row)
      ? h(
          ElSelect,
          {
            modelValue: row.strategy,
            style: { width: '120px' },
            'onUpdate:modelValue': (v: PickLine['strategy']) => setField(row, 'strategy', v),
          },
          () =>
            ['FIFO', 'FEFO', 'MANUAL', 'ZONE_FIRST'].map((v) =>
              h(ElOption, { key: v, label: v, value: v }),
            ),
        )
      : row.strategy

  const remarkCell: FunctionalComponent<TableCellCtx<PickLine>> = ({ row }) =>
    isEditing(row)
      ? h(ElInput, {
          modelValue: row.remark,
          type: 'textarea',
          autosize: { minRows: 1, maxRows: 3 },
          'onUpdate:modelValue': (v: string) => setField(row, 'remark', String(v)),
        })
      : row.remark || '-'

  const statusCell: FunctionalComponent<TableCellCtx<PickLine>> = ({ row }) =>
    h('span', { class: `tag tag-${row.rowStatus}` }, statusText(row))

  const errorsCell: FunctionalComponent<TableCellCtx<PickLine>> = ({ row }) =>
    h(
      'span',
      {
        class: 'err',
        title: (Array.isArray(row.errors) ? row.errors : []).map((e) => e.message).join('\n'),
      },
      (Array.isArray(row.errors) ? row.errors : [])[0]?.message ?? '',
    )

  const opsCell: FunctionalComponent<TableCellCtx<PickLine>> = ({ row }) =>
    h('div', { class: 'ops' }, [
      !isEditing(row) ? link('编辑', () => startEdit(row)) : link('保存', () => saveEdit(row)),
      isEditing(row) ? link('取消', () => cancelEdit(row)) : null,
      canUndo(row) ? link('撤销', () => undoRow(row)) : h('span', { class: 'muted' }, '撤销'),
    ])

  const fixedLeft = store.toggles.fixedCols ? 'left' : undefined
  const fixedRight = store.toggles.fixedCols ? 'right' : undefined

  return [
    { key: 'sku', title: 'SKU', width: 140, fixed: fixedLeft },
    { key: 'skuName', title: '名称', width: 220, fixed: fixedLeft },
    { key: 'batch', title: '批次', width: 140 },
    { key: 'bin', title: '库位', width: 140 },
    {
      key: 'available',
      title: '可用',
      width: 110,
      align: 'right',
      valueGetter: (r) => formatNumber(r.available),
    },
    { key: 'pickQty', title: '拣货数量', width: 160, align: 'right', cell: pickQtyCell },
    { key: 'picker', title: '拣货人', width: 200, cell: pickerCell },
    { key: 'strategy', title: '策略', width: 150, align: 'center', cell: strategyCell },
    { key: 'remark', title: '备注', width: 240, cell: remarkCell },
    { key: 'rowStatus', title: '状态', width: 140, align: 'center', cell: statusCell },
    { key: 'errors', title: '错误', width: 260, cell: errorsCell },
    { key: 'op', title: '操作', width: 220, fixed: fixedRight, cell: opsCell },
  ]
})

loadLeft()
</script>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 200px 1fr;
  gap: 12px;
  align-items: start;
}

.panel {
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  padding: 10px;
  background: var(--el-bg-color);
}

.panel-title {
  font-weight: 700;
  margin-bottom: 8px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 34px;
}

.table-wrap {
  height: calc(100vh - 520px);
}

.hint {
  margin-bottom: 8px;
}

.summary {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
}

.dot {
  margin: 0 8px;
}

.link {
  color: var(--el-color-primary);
  cursor: pointer;
  text-decoration: none;
}

.ops {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.muted {
  color: var(--el-text-color-secondary);
}

.err {
  color: var(--el-color-danger);
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

.tag-ready {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-5);
}

.tag-error {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-5);
}

.tag-validating {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning-light-5);
}

.tag-submitted {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}
</style>
