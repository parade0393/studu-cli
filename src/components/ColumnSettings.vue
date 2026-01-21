<template>
  <el-popover trigger="click" placement="bottom-start" width="380">
    <template #reference>
      <el-button size="small">{{ labelText }}</el-button>
    </template>
    <div class="panel">
      <el-text v-if="supportText" type="info" class="support">{{ supportText }}</el-text>
      <div class="list">
        <div v-for="(item, index) in orderedItems" :key="item.key" class="item">
          <el-checkbox
            :model-value="visibility[item.key] !== false"
            @change="(value) => toggleVisibility(item.key, value)"
          >
            <span class="title">{{ item.title }}</span>
          </el-checkbox>
          <div class="actions">
            <el-button size="small" :disabled="index === 0" @click="move(item.key, -1)"
              >上移</el-button
            >
            <el-button
              size="small"
              :disabled="index === orderedItems.length - 1"
              @click="move(item.key, 1)"
              >下移</el-button
            >
          </div>
        </div>
      </div>
      <div class="footer">
        <el-button size="small" @click="showAll">全选</el-button>
        <el-button size="small" @click="reset">重置</el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElButton, ElCheckbox, ElPopover, ElText } from 'element-plus'
import type { TableFixed } from '../adapters/table/types'
import { normalizeColumnOrder } from '../utils/columnSettings'

type ColumnItem = {
  key: string
  title: string
  fixed?: TableFixed
}

const props = defineProps<{
  columns: ColumnItem[]
  order: string[]
  visibility: Record<string, boolean>
  supportText?: string
  label?: string
}>()

const emit = defineEmits<{
  (event: 'update:order', value: string[]): void
  (event: 'update:visibility', value: Record<string, boolean>): void
}>()

const labelText = computed(() => props.label ?? '列设置')

const normalizedOrder = computed(() => normalizeColumnOrder(props.columns, props.order))

const orderedItems = computed<ColumnItem[]>(() => {
  const map = new Map(props.columns.map((col) => [col.key, col]))
  const keys = normalizedOrder.value
  const ordered = keys.map((key) => map.get(key)).filter(Boolean) as ColumnItem[]
  const fallback = props.columns.filter((col) => !keys.includes(col.key))
  return [...ordered, ...fallback]
})

function toggleVisibility(key: string, value: unknown) {
  const next = { ...props.visibility, [key]: Boolean(value) }
  emit('update:visibility', next)
}

function move(key: string, offset: number) {
  const keys = orderedItems.value.map((item) => item.key)
  const index = keys.indexOf(key)
  const target = index + offset
  if (index < 0 || target < 0 || target >= keys.length) return
  const next = [...keys]
  const [picked] = next.splice(index, 1)
  next.splice(target, 0, picked)
  emit('update:order', normalizeColumnOrder(props.columns, next))
}

function reset() {
  const keys = props.columns.map((col) => col.key)
  emit('update:order', normalizeColumnOrder(props.columns, keys))
  const visibility: Record<string, boolean> = {}
  for (const key of keys) visibility[key] = true
  emit('update:visibility', visibility)
}

function showAll() {
  const next = { ...props.visibility }
  for (const col of props.columns) next[col.key] = true
  emit('update:visibility', next)
}
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.support {
  font-size: 12px;
  line-height: 1.4;
}

.list {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title {
  font-size: 13px;
}

.actions {
  display: inline-flex;
  gap: 6px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
