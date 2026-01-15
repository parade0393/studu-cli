<template>
  <div class="view">
    <el-card shadow="never">
      <div class="bar">
        <div class="left">
          <el-button size="small" @click="reload">刷新</el-button>
          <el-button size="small" @click="expandTo(2)">展开到2层</el-button>
          <el-button size="small" @click="expandTo(3)">展开到3层</el-button>
          <el-button size="small" @click="collapseAll">全部折叠</el-button>
          <el-checkbox v-model="onlyAvailable" size="small">只看有库存</el-checkbox>
        </div>
        <div class="right">
          <el-text type="info">
            lazy load
            <template v-if="store.dataMode === 'server'"> + failure injection（2%）</template>
          </el-text>
        </div>
      </div>
    </el-card>

    <div class="body">
      <el-card class="left" shadow="never">
        <component
          :is="adapter.TreeTable"
          ref="treeRef"
          :roots="roots"
          row-key="id"
          :height="tableHeight"
          :loading="loading"
          border
          :columns="columns"
          :load-children="loadChildren"
          :filter-row="filterRow"
          :on-row-click="onRowClick"
          empty-text="暂无数据"
        />
      </el-card>

      <el-card class="right" shadow="never">
        <div class="title">节点详情</div>
        <el-descriptions v-if="selected" :column="1" size="small" border>
          <el-descriptions-item label="name">{{ selected.name }}</el-descriptions-item>
          <el-descriptions-item label="type">{{ selected.type }}</el-descriptions-item>
          <el-descriptions-item label="level">{{ selected.level }}</el-descriptions-item>
          <el-descriptions-item label="availableSum">{{
            selected.availableSum ?? '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="expireAtMin">{{
            selected.expireAtMin ?? '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="id">{{ selected.id }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else description="点击左侧行查看详情" />
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, type ComponentPublicInstance } from 'vue'
import {
  ElButton,
  ElCard,
  ElCheckbox,
  ElDescriptions,
  ElDescriptionsItem,
  ElEmpty,
  ElMessage,
  ElText,
} from 'element-plus'
import { fetchTreeChildren, fetchTreeRoots } from '../mock/api'
import { useBenchmarkStore } from '../stores/benchmark'
import type { TreeNode } from '../types/benchmark'
import { formatDateTime, formatNumber } from '../utils/format'
import { useTableAdapter } from '../adapters/table/useTableAdapter'
import type { TableColumnDef, TreeLoadChildren } from '../adapters/table/types'

const store = useBenchmarkStore()
const adapter = useTableAdapter()

const loading = ref(false)
const roots = ref<TreeNode[]>([])
const selected = ref<TreeNode | null>(null)
const onlyAvailable = ref(false)

const tableHeight = computed(() => 'calc(100vh - 280px)')

type TreeHandle = { expandTo?: (level: number) => Promise<void>; collapseAll?: () => void }
const treeRef = ref<(ComponentPublicInstance & TreeHandle) | null>(null)

async function reload() {
  loading.value = true
  try {
    roots.value = await fetchTreeRoots({ seed: store.seed, mode: store.dataMode })
    selected.value = null
    store.setPerf({ lastRenderNote: null })
  } finally {
    loading.value = false
  }
}

const loadChildren: TreeLoadChildren<TreeNode> = async (row) => {
  try {
    const children = await fetchTreeChildren({
      seed: store.seed,
      parentId: row.id,
      mode: store.dataMode,
    })
    return children
  } catch (e) {
    ElMessage.error((e as Error).message)
    return []
  }
}

function onRowClick(row: TreeNode) {
  selected.value = row
}

const filterRow = computed(() => {
  if (!onlyAvailable.value) return undefined
  return (row: TreeNode) => (row.availableSum ?? 1) > 0 || row.type !== 'batchStock'
})

function locate(row: TreeNode) {
  ElMessage.info(`定位到 /inventory（示意）：${row.name}`)
}

const columns = computed<TableColumnDef<TreeNode>[]>(() => {
  const link = (text: string, onClick: () => void) => h('a', { class: 'link', onClick }, text)
  return [
    {
      key: 'name',
      title: '节点名称',
      width: 280,
      fixed: store.toggles.fixedCols ? 'left' : undefined,
      valueGetter: (r) => r.name,
    },
    { key: 'type', title: '类型', width: 120, align: 'center', valueGetter: (r) => r.type },
    {
      key: 'availableSum',
      title: '可用合计',
      width: 140,
      align: 'right',
      valueGetter: (r) => formatNumber(r.availableSum),
    },
    {
      key: 'expireAtMin',
      title: '最早效期',
      width: 180,
      valueGetter: (r) => formatDateTime(r.expireAtMin),
    },
    { key: 'level', title: '层级', width: 90, align: 'center', valueGetter: (r) => r.level },
    {
      key: 'opLocate',
      title: '操作',
      width: 120,
      fixed: store.toggles.fixedCols ? 'right' : undefined,
      cell: ({ row }) => link('定位库存', () => locate(row)),
    },
  ]
})

async function expandTo(level: number) {
  if (store.libraryMode === 'el-table') {
    ElMessage.info('Element Plus Table 的 lazy tree 展开控制较受限；此按钮用于 Table V2 对比。')
    return
  }
  await treeRef.value?.expandTo?.(level)
}

function collapseAll() {
  if (store.libraryMode === 'el-table') {
    ElMessage.info('Element Plus Table 的 lazy tree 折叠控制较受限；此按钮用于 Table V2 对比。')
    return
  }
  treeRef.value?.collapseAll?.()
}

reload()
</script>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.body {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 12px;
}

.left {
  overflow: hidden;
}

.right {
  overflow: hidden;
}

.title {
  font-weight: 700;
  margin-bottom: 10px;
}

.link {
  color: var(--el-color-primary);
  cursor: pointer;
  text-decoration: none;
}
</style>
