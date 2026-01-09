<template>
  <el-card class="goals" shadow="never">
    <template #header>
      <div class="head">
        <div class="title">本页对比目标</div>
        <div class="tags">
          <el-tag v-for="t in goal.tags" :key="t.label" size="small" :type="t.type">{{
            t.label
          }}</el-tag>
        </div>
      </div>
    </template>

    <ul class="list">
      <li v-for="g in goal.goals" :key="g">{{ g }}</li>
    </ul>

    <el-text v-if="goal.note" class="note" type="info">{{ goal.note }}</el-text>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'
type GoalTag = { label: string; type: TagType }
type PageGoal = { tags: GoalTag[]; goals: string[]; note?: string }

const route = useRoute()

const fallbackGoal: PageGoal = {
  tags: [
    { label: '行/列大数据', type: 'info' },
    { label: '分组表头', type: 'info' },
    { label: '合并单元格', type: 'warning' },
    { label: '筛选/排序', type: 'info' },
  ],
  goals: [
    '验证 1w/10w 行、30/60/120 列下的渲染与滚动体验（含固定列/固定表头）',
    '分组表头（多级表头）在两种实现中的可维护性与约束差异',
    '列筛选 + 多列排序的 API 一致性（受控/非受控）与类型推导',
    '行/列合并（span/merge）能力、边界条件与性能影响',
  ],
  note: '建议：先把同一份 columns/filters/sort 复用到两种表格实现里，减少“业务差异”噪音。',
}

const goalByPath: Record<string, PageGoal> = {
  '/inventory': {
    tags: [
      { label: '行/列大数据', type: 'info' },
      { label: '分组表头', type: 'info' },
      { label: '合并单元格', type: 'warning' },
      { label: '筛选/排序', type: 'info' },
    ],
    goals: [
      '验证 1w/10w 行、30/60/120 列下的渲染与滚动体验（含固定列/固定表头）',
      '分组表头（多级表头）在两种实现中的可维护性与约束差异',
      '列筛选 + 多列排序的 API 一致性（受控/非受控）与类型推导',
      '行/列合并（span/merge）能力、边界条件与性能影响',
    ],
    note: '建议：先把同一份 columns/filters/sort 复用到两种表格实现里，减少“业务差异”噪音。',
  },
  '/tree': {
    tags: [
      { label: '树形/懒加载', type: 'success' },
      { label: '展开控制', type: 'warning' },
      { label: '稳定性', type: 'danger' },
    ],
    goals: [
      '对比 lazy tree：节点展开、加载中态、失败重试/错误提示（server 模式）',
      '对比“展开到 N 层/全部折叠”能力：是否原生支持、实现复杂度与卡顿情况',
      '对比行点击/选中与右侧详情联动：事件模型、类型、安全性（不崩溃）',
    ],
    note: 'local 模式不注入失败；server 模式含延迟与 2% failure injection。',
  },
  '/picking': {
    tags: [
      { label: '复杂编辑', type: 'warning' },
      { label: '校验/撤销', type: 'danger' },
      { label: '双表联动', type: 'info' },
    ],
    goals: [
      '对比“行内编辑”体验：输入控件渲染、焦点管理、性能、可读性（TS 类型）',
      '对比校验与错误展示：同步校验/异步校验、错误聚合、提示位置与一致性',
      '对比撤销/取消/保存：历史栈、最小重渲染、与表格行更新机制的耦合度',
      '对比左右表联动：选择同步、批量操作按钮状态、可扩展性',
    ],
  },
  '/exceptions': {
    tags: [
      { label: '筛选/排序', type: 'info' },
      { label: '批量操作', type: 'warning' },
      { label: '详情侧栏', type: 'info' },
    ],
    goals: [
      '对比筛选/排序的可控性：受控状态、列配置复用、与服务端模式的衔接',
      '对比批量操作：选中行 key 管理、跨页策略（示意）、与 UI 状态一致性',
      '对比详情与操作流：处理中/完成态切换、结果提示、回写与刷新策略',
    ],
  },
}

const goal = computed<PageGoal>(() => goalByPath[route.path] ?? fallbackGoal)
</script>

<style scoped>
.goals {
  margin-top: 12px;
  border-radius: 10px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title {
  font-weight: 700;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.list {
  margin: 0;
  padding-left: 18px;
  line-height: 1.7;
}

.note {
  display: block;
  margin-top: 10px;
}
</style>
