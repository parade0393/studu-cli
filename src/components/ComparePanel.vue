<template>
  <el-card class="panel" shadow="never">
    <div class="row">
      <div class="left">
        <el-form :inline="true" label-width="90px" size="small">
          <el-form-item label="库模式">
            <el-select v-model="store.libraryMode" style="width: 180px">
              <el-option label="Element Plus: Table" value="el-table" />
              <el-option label="Element Plus: Table V2 (Virtualized)" value="el-table-v2" />
              <el-option label="Ant Design Vue: Table" value="ant-table" />
              <el-option label="TanStack Table (Headless)" value="tanstack-table" />
            </el-select>
          </el-form-item>

          <el-form-item>
            <template #label>
              <span class="label-with-tip">
                数据规模
                <el-tooltip content="修改后点击查询生效" placement="top">
                  <span class="tip-icon" aria-label="提示">?</span>
                </el-tooltip>
              </span>
            </template>
            <el-radio-group v-model="store.dataSize">
              <el-radio-button :value="100">0.1k</el-radio-button>
              <el-radio-button :value="1000">1k</el-radio-button>
              <el-radio-button :value="10000">10k</el-radio-button>
              <el-radio-button :value="100000">100k</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="列规模">
            <el-radio-group v-model="store.columnSize">
              <el-radio-button :value="30">30</el-radio-button>
              <el-radio-button :value="60">60</el-radio-button>
              <el-radio-button :value="120">120</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="数据模式">
            <el-radio-group v-model="store.dataMode">
              <el-radio-button value="local">local</el-radio-button>
              <el-radio-button value="server">server(mock)</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <el-divider class="divider" />

        <el-form :inline="true" label-width="90px" size="small">
          <el-form-item label="功能开关">
            <el-checkbox v-model="store.toggles.rowVirtual">rowVirtual</el-checkbox>
            <el-checkbox v-model="store.toggles.colVirtual">colVirtual</el-checkbox>
            <el-checkbox v-model="store.toggles.fixedCols">fixedCols</el-checkbox>
            <el-checkbox v-model="store.toggles.groupedHeader">groupedHeader</el-checkbox>
            <el-checkbox v-model="store.toggles.merge">merge</el-checkbox>
            <el-checkbox v-model="store.toggles.tree">tree</el-checkbox>
            <el-checkbox v-model="store.toggles.editable">editable</el-checkbox>
            <el-checkbox v-model="store.toggles.selection">selection</el-checkbox>
          </el-form-item>

          <el-form-item>
            <el-button @click="copyConfig">复制配置JSON</el-button>
            <el-button @click="store.reset()">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="right">
        <div class="metric">
          <div class="label">request</div>
          <div class="value">{{ ms(store.perf.lastRequestMs) }}</div>
        </div>
        <div class="metric">
          <div class="label">compute</div>
          <div class="value">{{ ms(store.perf.lastComputeMs) }}</div>
        </div>
        <div class="metric wide">
          <div class="label">note</div>
          <div class="value">{{ store.perf.lastRenderNote ?? '-' }}</div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElCheckbox,
  ElDivider,
  ElForm,
  ElFormItem,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
  ElTooltip,
} from 'element-plus'
import { useBenchmarkStore } from '../stores/benchmark'

const store = useBenchmarkStore()

function ms(v: number | null) {
  if (v == null) return '-'
  return `${v.toFixed(0)}ms`
}

async function copyConfig() {
  const payload = {
    libraryMode: store.libraryMode,
    dataMode: store.dataMode,
    dataSize: store.dataSize,
    columnSize: store.columnSize,
    seed: store.seed,
    toggles: store.toggles,
  }
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
}
</script>

<style scoped>
.panel {
  border-radius: 10px;
}

.row {
  display: flex;
  gap: 12px;
}

.left {
  flex: 1;
  min-width: 700px;
}

.right {
  width: 260px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  align-content: start;
}

.divider {
  margin: 10px 0;
}

.metric {
  padding: 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.metric.wide {
  grid-column: 1 / -1;
}

.label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 50%;
  font-size: 11px;
  line-height: 1;
  color: var(--el-text-color-secondary);
  cursor: help;
}

.label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.value {
  margin-top: 4px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
