# MOCK-SPEC（数据生成与 Mock API 规范）— Table 组件库对比 Demo

## 1. 总则

- 所有页面共用同一套 mock 生成器与 mock API 层。
- 必须支持：`local`（一次性生成全量数据）与 `server(mock)`（按 query 返回分页/排序/过滤后的切片）。
- mock 需支持“可复现”：给定同一 seed 与同一开关配置，生成结果一致（便于对比与复测）。

## 2. 数据规模与分布

### 2.1 行数档位

- `1k`：用于快速开发与功能调试
- `10k`：用于常规对比
- `100k`：用于压力与边界

### 2.2 列数档位

- `30`：默认列集（见 `COLUMNS.md`）
- `60/120`：在默认列集基础上追加 ext\* 列

### 2.3 库存数据（InventoryRow）生成分布

- `warehouse`：3 个（WH-A/WH-B/WH-C）
- `zone`：每仓库 6 个（Z01~Z06）
- `bin`：每库区 80 个（B0001~B0080），组合后约 3*6*80=1440 个库位
- `sku`：1000 个（SKU000001~SKU001000）
- `batch`：每个 sku 1~5 个批次（BATCH-YYYYMMDD-xx）
- 数量：
  - `onHand`：0~500 随机
  - `reserved`：0~min(200,onHand)
  - `damaged`：0~min(20,onHand-reserved)
  - `frozen`：freezeStatus=FROZEN 时 10~min(100,onHand)
  - `available = max(0, onHand - reserved - damaged - frozen)`
- 时间：
  - `inboundAt`：过去 180 天内随机
  - `lastMoveAt`：`inboundAt` 后 0~90 天内
  - `expireAt`：未来 -30~+365 天（包含已过期与临期，用于高亮与异常）
- 枚举：
  - `qualityStatus`：OK 80%，HOLD 15%，NG 5%
  - `freezeStatus`：NONE 85%，FROZEN 15%
  - `abcClass`：A 20%，B 30%，C 50%
  - `riskLevel`：由 expireAt 推导（建议）：
    - 已过期：5
    - 0~7 天：4
    - 8~30 天：3
    - 31~90 天：2
    - 90+：1

## 3. merge 连续段（用于 /inventory）

目的：制造“连续相同 sku+batch”的行段，验证单元格合并逻辑。

### 3.1 规则

- 生成 inventory 列表后，按 `sku + batch` 排序（或按某种稳定分组）
- 对其中约 30% 的组，强制把该组的行放成连续段
- 连续段长度分布：2~12（平均 4）

### 3.2 验证

- merge 开关开启后：`sku/skuName/batch` 在段内只显示首行，其余行显示合并
- 滚动/hover/selection 不能错乱

## 4. 树数据（/tree）生成与懒加载

### 4.1 树结构

- level0：warehouse（3）
- level1：zone（每 warehouse 6）
- level2：bin（每 zone 80）
- level3：batchStock（每 bin 0~20 条，来自 inventory 聚合/采样）

### 4.2 懒加载 API

- 展开节点时调用：`GET /api/tree/children?parentId=...&seed=...`
- 响应：`TreeNode[]`

### 4.3 失败注入（必须）

- 失败率：2%（可通过开关调到 10%）
- 失败时返回：`{ error: { code, message } }`
- UI：节点行内显示“加载失败 [重试]”

### 4.4 聚合字段

- `availableSum`：子树 inventory.available 求和（或采样求和）
- `expireAtMin`：子树最早 expireAt

## 5. /picking 数据与行为

### 5.1 左表（可拣库存）

- 数据来源：inventory 的子集（例如只取 available>0 且 qualityStatus=OK）
- 默认排序：expireAt 升序（贴近 FEFO）

### 5.2 生成拣货明细（必须）

输入：左表选中的 InventoryRow[]
输出：PickLine[]

- `lineId`：唯一
- `sourceId=id`
- `pickQty` 默认：
  - FEFO：`min(available, 10)`
  - FIFO：`min(available, 20)`
  - MANUAL：默认 null（引导用户填）
  - ZONE_FIRST：`min(available, 15)`
- `pickerId/pickerName` 默认：null
- `rowStatus`：
  - 若 pickQty 为 null：dirty
  - 否则 dirty（需 picker 才能 ready）

### 5.3 同步校验（必须）

- pickQty：required，>0，<=available
- pickerId：required

### 5.4 异步校验（必须：并发控制）

API：`POST /api/pickers/validate` body: `{ pickerId, waveId?, lineId }`

- 延迟：150~600ms
- 失败率：5%（返回无效/不可接单）
- 并发控制要求：同一行同一字段发起多次校验，必须只采信最后一次结果（过期响应丢弃）

### 5.5 picker 远程搜索（必须）

API：`GET /api/pickers/search?q=...`

- debounce：300ms
- 返回：`{ id, name }[]`（最多 20 条）
- 模拟“无结果/服务失败”场景

### 5.6 提交（必须）

API：`POST /api/picking/submit` body: `{ lines: PickLine[] }`

- 仅提交 rowStatus=ready 的行
- 响应：逐行结果：success/fail + message
- 成功：rowStatus=submitted（锁行只读）
- 失败：rowStatus=error（errors 填充），并提供“一键回退 dirty”操作

### 5.7 撤销/重做（MVP）

- 对 PickLine 的可编辑字段（pickQty/picker/strategy/remark）维护每行历史栈（>=10）
- 撤销后必须重新触发同步校验；必要时触发异步校验

## 6. /exceptions 数据与 mock API

### 6.1 异常生成规则

基于 inventory 派生：

- SHORT：available=0 且 reserved>0
- EXPIRE_RISK：expireAt <= now+7d
- FROZEN：freezeStatus=FROZEN
- COUNT_DIFF：随机 3% 注入

### 6.2 异常列表 API

- `GET /api/exceptions` 支持 query（filters/sort/page）

### 6.3 行操作 API（必须）

- `POST /api/exceptions/:id/process`（标记处理中）
- `POST /api/exceptions/:id/assign`（转派）
- `POST /api/exceptions/:id/create-adjustment`（生成调整单）

要求：

- 延迟 120~500ms
- 失败率 3%（用于验证 UI 的错误与重试）

### 6.4 详情与日志

- `GET /api/exceptions/:id/detail`
- `GET /api/exceptions/:id/timeline`
