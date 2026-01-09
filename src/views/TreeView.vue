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
          <el-text type="info">lazy load + failure injection（2%）</el-text>
        </div>
      </div>
    </el-card>

    <div class="body">
      <el-card class="left" shadow="never">
        <template v-if="store.libraryMode === 'el-table'">
          <el-table
            v-loading="loading"
            :data="roots"
            row-key="id"
            border
            :height="tableHeight"
            lazy
            :load="loadChildren"
            :tree-props="{ hasChildren: 'hasChildren', children: 'children' }"
            @row-click="(r: TreeNode) => (selected = r)"
          >
            <el-table-column
              prop="name"
              label="节点名称"
              width="280"
              fixed="left"
              show-overflow-tooltip
            />
            <el-table-column prop="type" label="类型" width="120" align="center" />
            <el-table-column prop="availableSum" label="可用合计" width="140" align="right" />
            <el-table-column prop="expireAtMin" label="最早效期" width="180" />
            <el-table-column prop="level" label="层级" width="90" align="center" />
            <el-table-column label="操作" width="120" fixed="right" align="center">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click.stop="locate(row)"
                  >定位库存</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else>
          <el-auto-resizer>
            <template #default="{ height, width }">
              <el-table-v2
                :columns="v2Cols"
                :data="flatRows"
                :height="height"
                :width="width"
                fixed
              />
            </template>
          </el-auto-resizer>
        </template>
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
import { computed, h, ref } from 'vue'
import { ElAutoResizer, ElMessage } from 'element-plus'
import { TableV2FixedDir } from 'element-plus'
import { fetchTreeChildren, fetchTreeRoots } from '../mock/api'
import { useBenchmarkStore } from '../stores/benchmark'
import type { TreeNode } from '../types/benchmark'
import { formatDateTime, formatNumber } from '../utils/format'

const store = useBenchmarkStore()

const loading = ref(false)
const roots = ref<TreeNode[]>([])
const selected = ref<TreeNode | null>(null)
const onlyAvailable = ref(false)

const tableHeight = computed(() => 'calc(100vh - 280px)')

async function reload() {
  loading.value = true
  try {
    roots.value = await fetchTreeRoots({ seed: store.seed })
    selected.value = null
    if (store.libraryMode === 'el-table-v2') {
      flatRows.value = flatten(roots.value)
    }
    store.setPerf({ lastRenderNote: null })
  } finally {
    loading.value = false
  }
}

async function loadChildren(
  row: TreeNode,
  _treeNode: unknown,
  resolve: (data: TreeNode[]) => void,
) {
  try {
    const children = await fetchTreeChildren({ seed: store.seed, parentId: row.id })
    const filtered = onlyAvailable.value
      ? children.filter((c) => (c.availableSum ?? 1) > 0)
      : children
    resolve(filtered)
  } catch (e) {
    ElMessage.error((e as Error).message)
    resolve([])
  }
}

function locate(row: TreeNode) {
  ElMessage.info(`定位到 /inventory（示意）：${row.name}`)
}

type FlatRow = TreeNode & { __expanded?: boolean; __loading?: boolean; __error?: string }

const flatRows = ref<FlatRow[]>([])
const expanded = ref(new Set<string>())
const nodeMap = ref(new Map<string, FlatRow>())

function flatten(list: TreeNode[]): FlatRow[] {
  const out: FlatRow[] = []
  const walk = (nodes: TreeNode[], level: number) => {
    for (const n of nodes) {
      const row: FlatRow = { ...n, level }
      nodeMap.value.set(row.id, row)
      out.push(row)
      if (expanded.value.has(row.id) && row.children?.length) walk(row.children, level + 1)
    }
  }
  walk(list, 0)
  return onlyAvailable.value
    ? out.filter((r) => (r.availableSum ?? 1) > 0 || r.type !== 'batchStock')
    : out
}

async function toggleExpand(row: FlatRow) {
  if (!row.hasChildren) return
  const id = row.id
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
    flatRows.value = flatten(roots.value)
    return
  }

  expanded.value.add(id)
  const current = nodeMap.value.get(id)
  if (current && !current.children) {
    current.__loading = true
    flatRows.value = flatten(roots.value)
    try {
      const children = await fetchTreeChildren({ seed: store.seed, parentId: id })
      current.children = onlyAvailable.value
        ? children.filter((c) => (c.availableSum ?? 1) > 0)
        : children
    } catch (e) {
      current.__error = (e as Error).message
      expanded.value.delete(id)
      ElMessage.error(current.__error)
    } finally {
      current.__loading = false
    }
  }
  flatRows.value = flatten(roots.value)
}

function collapseAll() {
  expanded.value = new Set()
  flatRows.value = flatten(roots.value)
}

async function expandTo(level: number) {
  if (store.libraryMode === 'el-table') {
    ElMessage.info('Element Plus Table 树形展开控制在 lazy 场景较受限，此处仅在 Table V2 体验。')
    return
  }
  await ensureExpandToLevel(level)
}

async function ensureExpandToLevel(level: number) {
  const queue: FlatRow[] = flatten(roots.value).filter((r) => r.level < level && r.hasChildren)
  for (const r of queue) {
    if (r.level >= level) continue
    await toggleExpand(r)
  }
}

const v2Cols = computed(() => [
  {
    key: 'name',
    dataKey: 'name',
    title: '节点名称',
    width: 320,
    fixed: store.toggles.fixedCols ? TableV2FixedDir.LEFT : undefined,
    cellRenderer: ({ rowData }: { rowData: FlatRow }) => {
      const indent = rowData.level * 14
      const icon = rowData.hasChildren ? (expanded.value.has(rowData.id) ? '▼' : '▶') : '•'
      const status = rowData.__loading ? '（加载中）' : ''
      return h(
        'div',
        {
          style: { paddingLeft: `${indent}px`, display: 'flex', gap: '6px', alignItems: 'center' },
        },
        [
          h(
            'span',
            {
              style: { cursor: rowData.hasChildren ? 'pointer' : 'default' },
              onClick: () => toggleExpand(rowData),
            },
            icon,
          ),
          h('span', { title: rowData.name }, rowData.name),
          h('span', { style: { color: 'var(--el-text-color-secondary)' } }, status),
        ],
      )
    },
  },
  { key: 'type', dataKey: 'type', title: '类型', width: 120, align: 'center' },
  {
    key: 'availableSum',
    dataKey: 'availableSum',
    title: '可用合计',
    width: 140,
    align: 'right',
    cellRenderer: ({ rowData }: { rowData: FlatRow }) => formatNumber(rowData.availableSum),
  },
  {
    key: 'expireAtMin',
    dataKey: 'expireAtMin',
    title: '最早效期',
    width: 180,
    cellRenderer: ({ rowData }: { rowData: FlatRow }) => formatDateTime(rowData.expireAtMin),
  },
  { key: 'level', dataKey: 'level', title: '层级', width: 90, align: 'center' },
  {
    key: 'op',
    dataKey: 'op',
    title: '操作',
    width: 120,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: FlatRow }) =>
      h(
        'span',
        {
          style: { color: 'var(--el-color-primary)', cursor: 'pointer' },
          onClick: () => locate(rowData),
        },
        '定位',
      ),
  },
])

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
</style>
