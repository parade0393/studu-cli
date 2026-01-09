import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/inventory' },
    {
      path: '/inventory',
      name: 'inventory',
      component: () => import('../views/InventoryView.vue'),
    },
    { path: '/tree', name: 'tree', component: () => import('../views/TreeView.vue') },
    { path: '/picking', name: 'picking', component: () => import('../views/PickingView.vue') },
    {
      path: '/exceptions',
      name: 'exceptions',
      component: () => import('../views/ExceptionsView.vue'),
    },
  ],
})

export default router
