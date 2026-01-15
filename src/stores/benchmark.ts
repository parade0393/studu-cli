import { defineStore } from 'pinia'

export type LibraryMode = 'el-table' | 'el-table-v2'
export type DataMode = 'local' | 'server'
export type DataSize = 100 | 1000 | 10000 | 100000
export type ColumnSize = 30 | 60 | 120

const DEFAULT_SEED = 20260108

/**
 * 对比开关（PRD 3.1）。
 * 说明：并非所有表格方案都能完整支持全部开关；缺失能力可以保留开关值用于对比记录。
 */
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

/**
 * 性能指标展示（PRD 3.3）。
 * - request：模拟 server(mock) 的请求耗时（含 sleep 延迟）
 * - compute：前端排序/过滤/分页计算耗时
 */
export type PerfState = {
  lastRequestMs: number | null
  lastComputeMs: number | null
  lastRenderNote: string | null
}

export type BenchmarkState = {
  libraryMode: LibraryMode
  dataMode: DataMode
  dataSize: DataSize
  columnSize: ColumnSize
  /**
   * Mock 数据随机种子（见 doc/table-benchmark/MOCK-SPEC.md）。
   * - 同一 seed + 同一配置 => 生成一致的数据与（可控的）失败注入，便于对比与复测
   * - 修改 seed 会影响：行 id、字段分布、树懒加载子节点、提交/校验等 mock 随机结果
   */
  seed: number
  toggles: BenchmarkToggles
  perf: PerfState
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
  state: (): BenchmarkState => ({
    libraryMode: 'el-table-v2' as LibraryMode,
    dataMode: 'local' as DataMode,
    dataSize: 10000 as DataSize,
    columnSize: 30 as ColumnSize,
    seed: DEFAULT_SEED,
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
      this.seed = DEFAULT_SEED
      this.toggles = { ...defaultToggles }
      this.perf = { lastRequestMs: null, lastComputeMs: null, lastRenderNote: null }
    },
    setPerf(patch: Partial<PerfState>) {
      this.perf = { ...this.perf, ...patch }
    },
  },
})
