import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { ElLoading } from 'element-plus'

// Element Plus 基础样式（组件按需导入）
import 'element-plus/dist/index.css'
// Ant Design Vue 基础样式（组件按需导入）
import 'ant-design-vue/dist/reset.css'
// AG Grid 基础样式（社区版）
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
// VXE UI 基础样式
import 'vxe-pc-ui/lib/style.css'
// VXE Table 基础样式
import 'vxe-table/lib/style.css'

import './styles/table.css'

import App from './App.vue'
import router from './router'
import VxeUI from 'vxe-pc-ui'
import VxeTable from 'vxe-table'

const app = createApp(App)

ModuleRegistry.registerModules([AllCommunityModule])

app.config.errorHandler = (err, instance, info) => {
  const type = (instance as unknown as { type?: unknown } | null)?.type
  const name = (type as { name?: unknown } | null)?.name

  console.error('[VueError]', { err, info, component: typeof name === 'string' ? name : type })
}
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UnhandledRejection]', e.reason)
})
window.addEventListener('error', (e) => {
  const message = e.message || (e.error instanceof Error ? e.error.message : String(e.error ?? ''))
  if (message.includes('ResizeObserver loop')) return
  console.error('[WindowError]', e.error ?? e.message)
})

app.use(createPinia())
app.use(router)
app.use(VxeUI)
app.use(VxeTable)
app.use(ElLoading)

app.mount('#app')
