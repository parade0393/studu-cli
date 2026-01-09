<template>
  <el-table-column
    :prop="colProp"
    :label="spec.title"
    :width="spec.width"
    :fixed="fixed"
    :align="spec.align ?? defaultAlign"
    :sortable="sortable"
    show-overflow-tooltip
  >
    <template v-if="isAction" #default="{ row }">
      <el-button
        v-if="spec.key === 'opView'"
        size="small"
        link
        type="primary"
        @click="$emit('op', 'view', row)"
        >查看</el-button
      >
      <el-button v-else size="small" link type="primary" @click="$emit('op', 'copy', row)"
        >复制</el-button
      >
    </template>

    <template v-else-if="spec.key === 'qualityStatus'" #default="{ row }">
      <el-tag
        size="small"
        :type="
          row.qualityStatus === 'OK'
            ? 'success'
            : row.qualityStatus === 'HOLD'
              ? 'warning'
              : 'danger'
        "
      >
        {{ row.qualityStatus }}
      </el-tag>
    </template>

    <template v-else-if="spec.key === 'freezeStatus'" #default="{ row }">
      <el-tag size="small" :type="row.freezeStatus === 'FROZEN' ? 'warning' : 'info'">
        {{ row.freezeStatus }}
      </el-tag>
    </template>

    <template v-else-if="spec.key === 'abcClass'" #default="{ row }">
      <el-tag size="small" type="info">{{ row.abcClass }}</el-tag>
    </template>

    <template v-else-if="spec.key === 'riskLevel'" #default="{ row }">
      <span class="risk" :data-level="row.riskLevel">L{{ row.riskLevel }}</span>
    </template>

    <template v-else-if="isDate" #default="{ row }">
      {{ formatDateTime(asIsoString(getRowValue(row, String(spec.key)))) }}
    </template>

    <template v-else-if="isNumber" #default="{ row }">
      <span :class="spec.key === 'available' && row.available <= 5 ? 'num warn' : 'num'">
        {{ formatNumber(getRowValue(row, String(spec.key))) }}
      </span>
    </template>
  </el-table-column>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { InventoryRow } from '../../types/benchmark'
import type { InventoryColumnSpec } from '../../columns/inventory'
import type { BenchmarkToggles } from '../../stores/benchmark'
import { formatDateTime, formatNumber } from '../../utils/format'

defineEmits<{
  (e: 'op', op: 'view' | 'copy', row: InventoryRow): void
}>()

const props = defineProps<{
  spec: InventoryColumnSpec
  toggles: BenchmarkToggles
}>()

const isAction = computed(() => props.spec.key === 'opView' || props.spec.key === 'opCopySku')
const isNumber = computed(
  () =>
    ['onHand', 'available', 'reserved', 'damaged', 'frozen'].includes(String(props.spec.key)) ||
    String(props.spec.key).startsWith('extNum'),
)
const isDate = computed(
  () =>
    ['inboundAt', 'lastMoveAt', 'expireAt'].includes(String(props.spec.key)) ||
    String(props.spec.key).startsWith('extDate'),
)
const defaultAlign = computed(() => (isNumber.value ? 'right' : 'left'))

const fixed = computed(() => {
  if (!props.toggles.fixedCols) return false
  return props.spec.fixed ?? false
})

const sortable = computed(() => {
  const k = String(props.spec.key)
  if (k.startsWith('op')) return false
  return (
    ['available', 'onHand', 'expireAt', 'riskLevel', 'warehouse', 'zone', 'bin'].includes(k) ||
    k.startsWith('ext')
  )
})

const colProp = computed(() => {
  if (isAction.value) return undefined
  return String(props.spec.key)
})

function getRowValue(row: InventoryRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key]
}

function asIsoString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
</script>

<style scoped>
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
</style>
