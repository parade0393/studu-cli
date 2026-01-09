<template>
  <el-container class="shell">
    <el-header class="header">
      <div class="brand">Table Benchmark</div>
      <el-menu :default-active="active" class="menu" mode="horizontal" router>
        <el-menu-item index="/inventory">/inventory</el-menu-item>
        <el-menu-item index="/tree">/tree</el-menu-item>
        <el-menu-item index="/picking">/picking</el-menu-item>
        <el-menu-item index="/exceptions">/exceptions</el-menu-item>
      </el-menu>
      <div class="spacer" />
      <el-link href="doc/table-benchmark/PRD.md" :underline="false" target="_blank">PRD</el-link>
      <span class="sep">·</span>
      <el-link href="doc/table-benchmark/UI-SKETCH.md" :underline="false" target="_blank"
        >UI</el-link
      >
    </el-header>

    <el-main class="main">
      <ComparePanel class="compare" />
      <div class="page">
        <router-view />
      </div>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ComparePanel from './ComparePanel.vue'

const route = useRoute()
const active = computed(() => (typeof route.path === 'string' ? route.path : '/inventory'))
</script>

<style scoped>
.shell {
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--el-border-color);
}

.brand {
  font-weight: 700;
  letter-spacing: 0.2px;
}

.menu {
  flex: 1;
  min-width: 420px;
}

.spacer {
  flex: 1;
}

.sep {
  color: var(--el-text-color-secondary);
}

.main {
  padding-top: 14px;
}

.compare {
  position: sticky;
  top: 10px;
  z-index: 10;
}

.page {
  margin-top: 12px;
}
</style>
