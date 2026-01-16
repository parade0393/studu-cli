import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { TableAdapter } from './types'
import { useBenchmarkStore } from '../../stores/benchmark'
import { elementPlusTableAdapter, elementPlusTableV2Adapter } from '../element-plus'
import { antDesignVueTableAdapter } from '../ant-design-vue'
import { tanstackTableAdapter } from '../tanstack-table'

export function useTableAdapter(): ComputedRef<TableAdapter> {
  const store = useBenchmarkStore()
  return computed(() => {
    switch (store.libraryMode) {
      case 'el-table-v2':
        return elementPlusTableV2Adapter
      case 'ant-table':
        return antDesignVueTableAdapter
      case 'tanstack-table':
        return tanstackTableAdapter
      default:
        return elementPlusTableAdapter
    }
  })
}
