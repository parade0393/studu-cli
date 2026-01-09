import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { TableAdapter } from './types'
import { useBenchmarkStore } from '../../stores/benchmark'
import { elementPlusTableAdapter, elementPlusTableV2Adapter } from '../element-plus'

export function useTableAdapter(): ComputedRef<TableAdapter> {
  const store = useBenchmarkStore()
  return computed(() =>
    store.libraryMode === 'el-table-v2' ? elementPlusTableV2Adapter : elementPlusTableAdapter,
  )
}
