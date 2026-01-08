# Table 组件库横向对比 Demo（Vue3 + TS）— 需求说明（PRD）

## 1. 背景与目标

你将用同一套业务需求与数据口径，在不同表格方案中分别实现：

- Element Plus：`Table`、`Virtualized Table (beta)`
- Ant Design Vue：`Table`、Surely Vue Table（如可用）
- 独立组件/库：阿里 VTable、vxe-table、TanStack Table、AG Grid（Community）

目标是可横向对比每个方案在「复杂交互编辑能力」上的：

- 能力覆盖（原生/需自研/不可行）
- API 与工程化体验（TS 类型、状态托管、可扩展点）
- 交互稳定性（编辑态 + 虚拟滚动 + 固定列/表头分组等组合）
- 性能与可维护性

## 2. 交付物

- 路由：`/inventory`、`/tree`、`/picking`、`/exceptions`
- 每个路由一个可独立运行页面（同一份 mock 与参数模型）
- 每个库实现一套页面（或通过 adapter 切换），对外表现一致
- 每个页面提供：功能开关、性能指标展示、错误/空态/加载态

## 3. 全局统一约定（所有页面/所有库）

### 3.1 顶部「对比开关区」

所有页面顶部固定一块“对比开关区”，用于控制同一变量，便于横向对比。

- 数据规模：`1k` / `10k` / `100k`
- 列规模：`30` / `60` / `120`
- 数据模式：`local`（前端排序/过滤）/ `server(mock)`（参数化请求）
- 功能开关：
  - `rowVirtual`（行虚拟滚动）
  - `colVirtual`（列虚拟滚动；做不到就标记缺失）
  - `fixedCols`（固定列）
  - `groupedHeader`（多级分组表头）
  - `merge`（单元格合并）
  - `tree`（树形）
  - `editable`（编辑）
  - `selection`（多选）
- 操作：`重置为默认`、`复制当前配置为链接/JSON`（可选加分）

### 3.2 统一 UI 行为

- Loading：表格加载中必须可见（Skeleton/Spin 均可），不允许“无响应”。
- Empty：空数据提供引导（清空筛选、刷新）。
- Error：mock 请求可失败，失败要可重试，并保留上次成功数据（加分）。
- 列宽：数值右对齐、枚举/状态居中、文本左对齐 + 省略号 + tooltip。
- 选中：支持跨滚动区保持 selection（如果库允许）；不允许滚动后选中错乱。
- 可访问性（加分）：Tab 进入表格、上下键移动行、Enter 打开详情。

### 3.3 统一性能基线（展示即可，不强制硬达标）

- 首屏可见（表头+前 20 行可交互）
- 10k 行：滚动不明显卡顿
- 100k 行：允许降级（分页/分段加载）但必须说明策略并能对比

> 说明：本对比的主轴是复杂编辑交互，性能用于暴露组合特性下的稳定性问题。

## 4. 统一数据与参数模型

### 4.1 Query 参数（server/mock 与 local 共用）

- `query = { page, pageSize, sort: SortRule[], filters: FilterRule[] }`
- `SortRule = { field: string, order: 'asc' | 'desc' }`
- `FilterRule = { field: string, op: FilterOp, value: unknown }`

`FilterOp` 取值（至少支持）：

- `textContains`
- `enumIn`
- `numberRange`（`[min,max]`，允许 null）
- `dateRange`（`[start,end]`，ISO 字符串，允许 null）
- `boolean`

### 4.2 统一行状态（编辑页面用）

- `rowStatus: 'clean' | 'dirty' | 'validating' | 'error' | 'ready' | 'submitted'`
- `errors: { field: string; message: string }[]`

### 4.3 统一实体（字段字典）

#### InventoryRow（库存行）

- `id: string`
- `warehouse: string` 仓库
- `zone: string` 库区
- `bin: string` 库位
- `sku: string`
- `skuName: string`
- `batch: string`
- `owner: string`
- `supplier: string`
- `qualityStatus: 'OK' | 'HOLD' | 'NG'`
- `freezeStatus: 'NONE' | 'FROZEN'`
- `abcClass: 'A' | 'B' | 'C'`
- `riskLevel: 1 | 2 | 3 | 4 | 5`
- `onHand: number`
- `available: number`
- `reserved: number`
- `damaged: number`
- `frozen: number`
- `inboundAt: string` ISO
- `lastMoveAt: string` ISO
- `expireAt: string` ISO

#### TreeNode（树节点）

- `id: string`
- `parentId?: string`
- `type: 'warehouse' | 'zone' | 'bin' | 'batchStock'`
- `name: string`
- `hasChildren: boolean`
- `level: number`
- `availableSum?: number`
- `expireAtMin?: string`

#### PickLine（拣货明细行）

- `lineId: string`
- `sourceId: string` 关联库存行 id
- `sku: string`
- `skuName: string`
- `batch: string`
- `bin: string`
- `available: number`
- `pickQty: number | null`
- `pickerId: string | null`
- `pickerName: string | null`
- `strategy: 'FIFO' | 'FEFO' | 'MANUAL' | 'ZONE_FIRST'`
- `remark: string`
- `rowStatus: ...`（见 4.2）
- `errors: ...`（见 4.2）

#### ExceptionRow（异常行）

- `id: string`
- `type: 'SHORT' | 'EXPIRE_RISK' | 'FROZEN' | 'COUNT_DIFF'`
- `sku: string`
- `skuName: string`
- `bin: string`
- `riskLevel: 1 | 2 | 3 | 4 | 5`
- `createdAt: string` ISO
- `status: 'OPEN' | 'PROCESSING' | 'DONE'`
- `assignee: string | null`
- `message: string`

## 5. 路由级需求

### 5.1 `/inventory` 库存总览（读性能 + 复杂表头）

**目的**：验证大数据渲染、分组表头、固定列、合并单元格、过滤排序的组合稳定性。

**页面组成**

- 顶部：对比开关区
- 筛选区：仓库/库区/关键字/状态/数量范围/效期范围
- 表格：分组表头 + 固定列 +（可选）行/列虚拟
- 底部：统计条（总行数、过滤后行数、选中数、渲染耗时）

**列与分组（默认 30 列，扩展到 120）**

- 货品信息：`sku`、`skuName`、`owner`、`supplier`、`batch`
- 库位信息：`warehouse`、`zone`、`bin`
- 数量信息：`onHand`、`available`、`reserved`、`damaged`、`frozen`
- 状态信息：`qualityStatus`、`freezeStatus`、`abcClass`、`riskLevel`
- 周转信息：`inboundAt`、`lastMoveAt`、`expireAt`
- 操作：`查看`、`复制 sku`（可选）

**合并（merge 开关开启时）**

- 按 `sku + batch` 连续行合并：`sku/skuName/batch` 三列

**过滤/排序**

- local：前端过滤与排序
- server(mock)：参数化请求，返回对应数据页

**验收点**

- 固定列 + 分组表头不对齐、不抖动
- merge 开启后滚动与 hover/选中不乱

### 5.2 `/tree` 库位/批次树表（树形 + 懒加载）

**目的**：验证树形表在懒加载、过滤、虚拟滚动等组合下的可用性。

**页面组成**

- 顶部：对比开关区
- 左侧：树表（可按 type 显示不同图标）
- 右侧：节点详情卡（聚合信息与操作日志占位）

**树行为**

- 懒加载：展开节点触发 `loadChildren(nodeId)`（mock 延迟 + 可失败）
- 控制：`展开到2层/3层`、`全部展开/折叠`、`只看 availableSum>0`

**表列**

- `name`、`type`、`availableSum`、`expireAtMin`、`level`、`操作(定位到 /inventory 筛选)`

**验收点**

- 懒加载时不阻塞滚动
- 过滤后展开状态策略明确（保留/重置二选一，并固定实现）

### 5.3 `/picking` 波次拣货工作台（复杂编辑主战场）

**目的**：对比各库的编辑模型、状态托管、批量操作与稳定性。

**页面布局**

- 左：可拣库存表（可筛选/可多选，读为主）
- 中：动作区（生成拣货行、移除、批量设置、提交）
- 右：拣货明细表（强编辑）
- 底部：汇总条（错误数、ready 数、合计 pickQty、提交耗时）

**核心流程（必须实现）**

1. 左表勾选多行库存 → 点击“生成拣货行”
2. 右表生成对应明细行（默认 `strategy=FEFO`；`pickQty` 默认=min(available, 建议量)）
3. 用户编辑：`pickQty/picker/strategy/remark`
4. 校验通过（行状态 `ready`）后允许提交
5. 提交：mock API 返回成功/失败；成功行锁定为 `submitted`（只读）；失败行可回退 `dirty` 并展示原因

**右表编辑要求（editable 开关开启）**

- 编辑模式：行级编辑（进入编辑后该行所有可编辑单元格进入编辑态）
- 编辑器：
  - `pickQty` 数字输入（支持滚轮禁用/可选）
  - `picker` 远程搜索下拉（mock async，输入 300ms debounce）
  - `strategy` 下拉
  - `remark` 文本域

**校验规则（必须）**

- 同步校验：
  - `pickQty` 必填，`>0` 且 `<= available`
  - `pickerId` 必填
- 联动：`strategy` 变更后，若行未手动改过 `pickQty`（或提供“重新计算”按钮），按策略重算默认 pickQty
- 异步校验：
  - 校验 `pickerId` 是否有效、是否可接单（mock Promise）
  - 并发控制：同一行同一字段仅保留最新一次请求结果（过期结果不得覆盖）

**行状态机（建议固定实现）**

- 初始：`clean`
- 任意编辑：`dirty`
- 触发校验：`validating`
- 校验失败：`error`（errors[] 非空）
- 校验通过：`ready`
- 提交成功：`submitted`

**批量能力（必须）**

- 多选右表行：批量设置 `picker/strategy`
- 向下填充：从当前单元格把值复制到下方选中行（至少对 `pickQty/picker/strategy` 生效）

**撤销/重做（MVP 必须）**

- 单行撤销：对当前行最近一次编辑可撤销（至少 10 步栈）
- 加分：全局撤销栈（跨行）

**验收点（最重要）**

- 编辑态 + 虚拟滚动：滚动/重渲染不丢输入、不串值、不跳行
- 异步校验：不乱序、不“过期覆盖”、可见状态明确
- 批量操作：批量设置后相关行自动重新校验并更新 rowStatus

### 5.4 `/exceptions` 异常处理（固定列 + 高频操作 + 展开/抽屉）

**目的**：验证自定义渲染与高频操作下的稳定性（固定列、展开行、复杂单元格）。

**页面组成**

- 顶部：对比开关区
- 表格：异常列表（可多选）
- 详情：右侧 Drawer（或行展开）显示时间线与处理表单

**交互要求**

- 行操作：`标记处理中`、`转派`、`生成调整单`（mock）
- 行展开或 Drawer：展示操作日志（mock）
- 条件高亮：风险等级、即将过期、冻结

**验收点**

- 固定列 + 展开/Drawer 同时存在不抖动、不乱对齐
- 高频操作（连续点 20 次）不明显卡顿或丢状态

## 6. 对比记录与打分（模板）

实现每个库后，按同一模板记录。

| 维度              | 结论（原生/自研/不可行） | 说明/坑位 | 代码位置 |
| ----------------- | ------------------------ | --------- | -------- |
| 行虚拟滚动        |                          |           |          |
| 列虚拟滚动        |                          |           |          |
| 分组表头          |                          |           |          |
| 固定列/固定头     |                          |           |          |
| merge 单元格      |                          |           |          |
| 树形 + 懒加载     |                          |           |          |
| 行级编辑          |                          |           |          |
| 异步校验并发控制  |                          |           |          |
| 批量编辑          |                          |           |          |
| 向下填充          |                          |           |          |
| 撤销/重做         |                          |           |          |
| TS 类型体验       |                          |           |          |
| 自定义渲染/扩展点 |                          |           |          |
| 性能与稳定性      |                          |           |          |
| 结论（推荐场景）  |                          |           |          |
