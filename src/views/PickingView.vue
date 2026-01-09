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
            <template v-if="store.libraryMode === 'el-table'">
              <el-table
                v-loading="leftLoading"
                :data="leftRows"
                row-key="id"
                border
                :height="tableHeight"
                @selection-change="onLeftSelectionChange"
              >
                <el-table-column
                  v-if="store.toggles.selection"
                  type="selection"
                  width="50"
                  fixed="left"
                />
                <el-table-column
                  prop="sku"
                  label="SKU"
                  width="140"
                  fixed="left"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="skuName"
                  label="名称"
                  width="220"
                  fixed="left"
                  show-overflow-tooltip
                />
                <el-table-column prop="batch" label="批次" width="140" show-overflow-tooltip />
                <el-table-column prop="bin" label="库位" width="140" show-overflow-tooltip />
                <el-table-column prop="available" label="可用" width="110" align="right" sortable />
                <el-table-column prop="qualityStatus" label="质量" width="100" align="center" />
                <el-table-column prop="expireAt" label="效期" width="170" />
              </el-table>
            </template>
            <template v-else>
              <el-auto-resizer>
                <template #default="{ height, width }">
                  <el-table-v2
                    :columns="leftV2Cols"
                    :data="leftRows"
                    :height="height"
                    :width="width"
                    fixed
                  />
                </template>
              </el-auto-resizer>
            </template>
          </div>
        </div>

        <div class="actions">
          <el-button type="primary" :disabled="!leftSelected.length" @click="generateLines"
            >生成拣货行 &gt;&gt;</el-button
          >
          <el-button :disabled="!rightSelected.length" @click="removeSelected"
            >&lt;&lt; 移除选中</el-button
          >
          <el-divider />
          <el-button :disabled="!rightSelected.length" @click="openBatchPicker"
            >批量设置 picker</el-button
          >
          <el-button :disabled="!rightSelected.length" @click="openBatchStrategy"
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
            >提交 ready 行</el-button
          >
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
            <template v-if="store.libraryMode === 'el-table'">
              <el-table
                :data="rightLines"
                row-key="lineId"
                border
                :height="tableHeight"
                @selection-change="onRightSelectionChange"
              >
                <el-table-column
                  v-if="store.toggles.selection"
                  type="selection"
                  width="50"
                  fixed="left"
                />
                <el-table-column prop="sku" label="SKU" width="140" fixed="left" />
                <el-table-column
                  prop="skuName"
                  label="名称"
                  width="220"
                  fixed="left"
                  show-overflow-tooltip
                />
                <el-table-column prop="batch" label="批次" width="140" />
                <el-table-column prop="bin" label="库位" width="140" />
                <el-table-column prop="available" label="可用" width="110" align="right" />

                <el-table-column prop="pickQty" label="拣货数量" width="150" align="right">
                  <template #default="{ row }">
                    <template v-if="isEditing(row)">
                      <el-input-number
                        :model-value="row.pickQty ?? undefined"
                        :min="0"
                        :max="row.available"
                        controls-position="right"
                        @update:model-value="(v) => setPickQty(row, v)"
                      />
                    </template>
                    <template v-else>{{ row.pickQty ?? '-' }}</template>
                  </template>
                </el-table-column>

                <el-table-column prop="pickerName" label="拣货人" width="190">
                  <template #default="{ row }">
                    <template v-if="isEditing(row)">
                      <el-select
                        :model-value="row.pickerId"
                        filterable
                        remote
                        reserve-keyword
                        :remote-method="remoteSearchPicker"
                        :loading="pickerLoading"
                        placeholder="搜索 picker"
                        style="width: 170px"
                        @update:model-value="(v) => onPickPicker(row, String(v))"
                      >
                        <el-option
                          v-for="p in pickerOptions"
                          :key="p.id"
                          :label="p.name"
                          :value="p.id"
                        />
                      </el-select>
                    </template>
                    <template v-else>{{ row.pickerName ?? '-' }}</template>
                  </template>
                </el-table-column>

                <el-table-column prop="strategy" label="策略" width="140" align="center">
                  <template #default="{ row }">
                    <template v-if="isEditing(row)">
                      <el-select
                        :model-value="row.strategy"
                        style="width: 120px"
                        @update:model-value="(v) => setField(row, 'strategy', v)"
                      >
                        <el-option label="FIFO" value="FIFO" />
                        <el-option label="FEFO" value="FEFO" />
                        <el-option label="MANUAL" value="MANUAL" />
                        <el-option label="ZONE_FIRST" value="ZONE_FIRST" />
                      </el-select>
                    </template>
                    <template v-else>{{ row.strategy }}</template>
                  </template>
                </el-table-column>

                <el-table-column prop="remark" label="备注" width="220">
                  <template #default="{ row }">
                    <template v-if="isEditing(row)">
                      <el-input
                        :model-value="row.remark"
                        type="textarea"
                        :autosize="{ minRows: 1, maxRows: 3 }"
                        @update:model-value="(v) => setField(row, 'remark', String(v))"
                      />
                    </template>
                    <template v-else>{{ row.remark || '-' }}</template>
                  </template>
                </el-table-column>

                <el-table-column prop="rowStatus" label="状态" width="120" align="center" sortable>
                  <template #default="{ row }">
                    <el-tag size="small" :type="statusType(row.rowStatus)">{{
                      row.rowStatus
                    }}</el-tag>
                  </template>
                </el-table-column>

                <el-table-column prop="errors" label="错误" width="260" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="err">{{ row.errors[0]?.message ?? '' }}</span>
                  </template>
                </el-table-column>

                <el-table-column label="操作" width="220" fixed="right" align="center">
                  <template #default="{ row }">
                    <el-button v-if="!isEditing(row)" size="small" @click="startEdit(row)"
                      >编辑</el-button
                    >
                    <el-button v-else size="small" type="primary" @click="saveEdit(row)"
                      >保存</el-button
                    >
                    <el-button v-if="isEditing(row)" size="small" @click="cancelEdit(row)"
                      >取消</el-button
                    >
                    <el-button size="small" :disabled="!canUndo(row)" @click="undoRow(row)"
                      >撤销</el-button
                    >
                  </template>
                </el-table-column>
              </el-table>
            </template>

            <template v-else>
              <el-auto-resizer>
                <template #default="{ height, width }">
                  <el-table-v2
                    :columns="rightV2Cols"
                    :data="rightLines"
                    :height="height"
                    :width="width"
                    fixed
                  />
                </template>
              </el-auto-resizer>
            </template>
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
import { computed, h, ref } from 'vue'
import {
  ElAutoResizer,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElTag,
} from 'element-plus'
import { TableV2FixedDir } from 'element-plus'
import { fetchInventory, searchPickers, submitPicking, validatePicker } from '../mock/api'
import { useBenchmarkStore } from '../stores/benchmark'
import type { InventoryRow, PickLine, Picker, Query } from '../types/benchmark'
import { formatDateTime, formatNumber } from '../utils/format'

const store = useBenchmarkStore()

const tableHeight = 'calc(100vh - 420px)'

const leftKeyword = ref('')
const leftLoading = ref(false)
const leftRows = ref<InventoryRow[]>([])
const leftSelected = ref<InventoryRow[]>([])

const rightLines = ref<PickLine[]>([])
const rightSelected = ref<PickLine[]>([])

const editing = ref(new Set<string>())
const editOrigin = ref(new Map<string, PickLine>())
const history = ref(new Map<string, PickLine[]>())
const validateToken = ref(new Map<string, number>())

const pickerLoading = ref(false)
const pickerOptions = ref<Picker[]>([])

const submitting = ref(false)
const submitMs = ref('-')

const leftHint = computed(() => {
  if (store.libraryMode === 'el-table-v2' && store.toggles.selection)
    return 'Table V2 本 Demo 未实现 selection（请用 Table 模式对比 selection 行为）。'
  return null
})

const rightHint = computed(() => {
  if (store.libraryMode === 'el-table-v2')
    return 'Table V2 这里采用“直接单元格可编辑”的实现，未做行级编辑/保存/取消（用于对比编辑控件在虚拟表内的稳定性）。'
  return null
})

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
  const adds = leftSelected.value.map((inv) => {
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
  const rm = new Set(rightSelected.value.map((r) => r.lineId))
  rightLines.value = rightLines.value.filter((r) => !rm.has(r.lineId))
  rightSelected.value = []
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

function statusType(s: PickLine['rowStatus']) {
  if (s === 'ready') return 'success'
  if (s === 'error') return 'danger'
  if (s === 'validating') return 'warning'
  if (s === 'submitted') return 'info'
  return undefined
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
  for (const l of rightSelected.value) {
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
  for (const l of rightSelected.value) {
    setField(l, 'strategy', batchStrategy.value as PickLine['strategy'])
  }
  batchStrategyVisible.value = false
}

const leftV2Cols = computed(() => [
  {
    key: 'sku',
    dataKey: 'sku',
    title: 'SKU',
    width: 140,
    fixed: store.toggles.fixedCols ? TableV2FixedDir.LEFT : undefined,
  },
  {
    key: 'skuName',
    dataKey: 'skuName',
    title: '名称',
    width: 220,
    fixed: store.toggles.fixedCols ? TableV2FixedDir.LEFT : undefined,
  },
  { key: 'batch', dataKey: 'batch', title: '批次', width: 140 },
  { key: 'bin', dataKey: 'bin', title: '库位', width: 140 },
  {
    key: 'available',
    dataKey: 'available',
    title: '可用',
    width: 110,
    align: 'right',
    cellRenderer: ({ rowData }: { rowData: InventoryRow }) => formatNumber(rowData.available),
  },
  { key: 'qualityStatus', dataKey: 'qualityStatus', title: '质量', width: 100, align: 'center' },
  {
    key: 'expireAt',
    dataKey: 'expireAt',
    title: '效期',
    width: 170,
    cellRenderer: ({ rowData }: { rowData: InventoryRow }) => formatDateTime(rowData.expireAt),
  },
])

function v2CellEditors(line: PickLine) {
  const disabled = line.rowStatus === 'submitted' || !store.toggles.editable
  return {
    pickQty: h(ElInputNumber, {
      modelValue: line.pickQty ?? undefined,
      min: 0,
      max: line.available,
      controlsPosition: 'right',
      disabled,
      'onUpdate:modelValue': (v: number | undefined) => setPickQty(line, v),
    }),
    picker: h(
      ElSelect,
      {
        modelValue: line.pickerId ?? '',
        filterable: true,
        remote: true,
        reserveKeyword: true,
        loading: pickerLoading.value,
        remoteMethod: remoteSearchPicker,
        disabled,
        style: { width: '160px' },
        'onUpdate:modelValue': (v: string) => onPickPicker(line, String(v)),
      },
      () => pickerOptions.value.map((p) => h(ElOption, { key: p.id, label: p.name, value: p.id })),
    ),
    strategy: h(
      ElSelect,
      {
        modelValue: line.strategy,
        disabled,
        style: { width: '120px' },
        'onUpdate:modelValue': (v: PickLine['strategy']) => setField(line, 'strategy', v),
      },
      () =>
        ['FIFO', 'FEFO', 'MANUAL', 'ZONE_FIRST'].map((v) =>
          h(ElOption, { key: v, label: v, value: v }),
        ),
    ),
    remark: h(ElInput, {
      modelValue: line.remark,
      type: 'text',
      disabled,
      'onUpdate:modelValue': (v: string) => setField(line, 'remark', v),
    }),
  }
}

const rightV2Cols = computed(() => [
  {
    key: 'sku',
    dataKey: 'sku',
    title: 'SKU',
    width: 140,
    fixed: store.toggles.fixedCols ? TableV2FixedDir.LEFT : undefined,
  },
  {
    key: 'skuName',
    dataKey: 'skuName',
    title: '名称',
    width: 220,
    fixed: store.toggles.fixedCols ? TableV2FixedDir.LEFT : undefined,
  },
  { key: 'batch', dataKey: 'batch', title: '批次', width: 140 },
  { key: 'bin', dataKey: 'bin', title: '库位', width: 140 },
  {
    key: 'available',
    dataKey: 'available',
    title: '可用',
    width: 110,
    align: 'right',
    cellRenderer: ({ rowData }: { rowData: PickLine }) => formatNumber(rowData.available),
  },
  {
    key: 'pickQty',
    dataKey: 'pickQty',
    title: '拣货数量',
    width: 160,
    align: 'right',
    cellRenderer: ({ rowData }: { rowData: PickLine }) =>
      store.toggles.editable ? v2CellEditors(rowData).pickQty : String(rowData.pickQty ?? '-'),
  },
  {
    key: 'pickerName',
    dataKey: 'pickerName',
    title: '拣货人',
    width: 200,
    cellRenderer: ({ rowData }: { rowData: PickLine }) =>
      store.toggles.editable ? v2CellEditors(rowData).picker : (rowData.pickerName ?? '-'),
  },
  {
    key: 'strategy',
    dataKey: 'strategy',
    title: '策略',
    width: 150,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: PickLine }) =>
      store.toggles.editable ? v2CellEditors(rowData).strategy : rowData.strategy,
  },
  {
    key: 'remark',
    dataKey: 'remark',
    title: '备注',
    width: 220,
    cellRenderer: ({ rowData }: { rowData: PickLine }) =>
      store.toggles.editable ? v2CellEditors(rowData).remark : rowData.remark || '-',
  },
  {
    key: 'rowStatus',
    dataKey: 'rowStatus',
    title: '状态',
    width: 120,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: PickLine }) =>
      h(ElTag, { type: statusType(rowData.rowStatus), size: 'small' }, () => rowData.rowStatus),
  },
  {
    key: 'errors',
    dataKey: 'errors',
    title: '错误',
    width: 260,
    cellRenderer: ({ rowData }: { rowData: PickLine }) => rowData.errors[0]?.message ?? '',
  },
])

function onLeftSelectionChange(v: InventoryRow[]) {
  leftSelected.value = v
}

function onRightSelectionChange(v: PickLine[]) {
  rightSelected.value = v
}

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

.err {
  color: var(--el-color-danger);
}
</style>
