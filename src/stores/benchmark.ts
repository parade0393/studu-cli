import { defineStore } from 'pinia'

export type LibraryMode = 'el-table' | 'el-table-v2'
export type DataMode = 'local' | 'server'
export type DataSize = 1000 | 10000 | 100000
export type ColumnSize = 30 | 60 | 120

export type BenchmarkToggles = {
  rowVirtual: boolean
  colVirtual: boolean
  fixedCols: boolean
  groupedHeader: boolean
  merge: boolean
  tree: boolean
  editable: boolean
  selection: boolean
}

export type PerfState = {
  lastRequestMs: number | null
  lastComputeMs: number | null
  lastRenderNote: string | null
}

const defaultToggles: BenchmarkToggles = {
  rowVirtual: true,
  colVirtual: false,
  fixedCols: true,
  groupedHeader: true,
  merge: false,
  tree: true,
  editable: true,
  selection: true,
}

export const useBenchmarkStore = defineStore('benchmark', {
  state: () => ({
    libraryMode: 'el-table' as LibraryMode,
    dataMode: 'local' as DataMode,
    dataSize: 10000 as DataSize,
    columnSize: 30 as ColumnSize,
    seed: 20260108,
    toggles: { ...defaultToggles } as BenchmarkToggles,
    perf: {
      lastRequestMs: null,
      lastComputeMs: null,
      lastRenderNote: null,
    } as PerfState,
  }),
  actions: {
    reset() {
      this.libraryMode = 'el-table'
      this.dataMode = 'local'
      this.dataSize = 10000
      this.columnSize = 30
      this.seed = 20260108
      this.toggles = { ...defaultToggles }
      this.perf = { lastRequestMs: null, lastComputeMs: null, lastRenderNote: null }
    },
    setPerf(patch: Partial<PerfState>) {
      this.perf = { ...this.perf, ...patch }
    },
  },
})
