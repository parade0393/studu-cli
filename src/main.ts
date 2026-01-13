import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/table.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.config.errorHandler = (err, instance, info) => {
  const type = (instance as unknown as { type?: unknown } | null)?.type
  const name = (type as { name?: unknown } | null)?.name

  console.error('[VueError]', { err, info, component: typeof name === 'string' ? name : type })
}
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UnhandledRejection]', e.reason)
})
window.addEventListener('error', (e) => {
  console.error('[WindowError]', e.error ?? e.message)
})

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')
