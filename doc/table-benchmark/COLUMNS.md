# Columns Spec（逐列清单）— Table 组件库对比 Demo

> 目的：把“同一套列定义”固化下来，便于你在不同表格库里逐一映射实现。
> 说明：本文件把列分为：默认 30 列（必须实现）+ 扩展列（用于 60/120 列压力）。

## 通用列属性约定

- `key`：字段名（与数据模型一致）
- `title`：列头文案
- `width`：默认宽度（px，建议值）
- `fixed`：`left | right | none`
- `align`：`left | center | right`
- `sortable`：是否可排序
- `filter`：过滤类型（见 PRD 的 FilterOp）
- `render`：显示渲染规则（枚举标签、日期格式、tooltip 等）
- `editor`：编辑器类型（仅 /picking 右表、/exceptions Drawer 表单用）

日期显示统一：`YYYY-MM-DD HH:mm`
数值显示统一：千分位（可选），无小数（库存类）

---

## /inventory — 库存总览

### A. 默认列（30）

**货品信息（分组表头：Product）**

1. `sku` | SKU | 140 | fixed:left | left | sortable:Y | filter:textContains | render: ellipsis+tooltip
2. `skuName` | 名称 | 220 | fixed:left | left | sortable:Y | filter:textContains | render: ellipsis+tooltip
3. `batch` | 批次 | 140 | none | left | sortable:Y | filter:textContains
4. `owner` | 货主 | 140 | none | left | sortable:Y | filter:enumIn
5. `supplier` | 供应商 | 160 | none | left | sortable:N | filter:textContains

**库位信息（分组表头：Location）** 6. `warehouse` | 仓库 | 120 | none | left | sortable:Y | filter:enumIn 7. `zone` | 库区 | 120 | none | left | sortable:Y | filter:enumIn 8. `bin` | 库位 | 140 | none | left | sortable:Y | filter:textContains

**数量信息（分组表头：Quantity）** 9. `onHand` | 现有 | 110 | none | right | sortable:Y | filter:numberRange 10. `available` | 可用 | 110 | fixed:right | right | sortable:Y | filter:numberRange | render: highlight if low 11. `reserved` | 占用 | 110 | none | right | sortable:Y | filter:numberRange 12. `damaged` | 残损 | 110 | none | right | sortable:Y | filter:numberRange 13. `frozen` | 冻结数 | 110 | none | right | sortable:Y | filter:numberRange

**状态信息（分组表头：Status）** 14. `qualityStatus` | 质量 | 100 | none | center | sortable:Y | filter:enumIn | render: tag(OK/HOLD/NG) 15. `freezeStatus` | 冻结状态 | 110 | none | center | sortable:Y | filter:enumIn | render: tag(NONE/FROZEN) 16. `abcClass` | ABC | 80 | none | center | sortable:Y | filter:enumIn | render: tag(A/B/C) 17. `riskLevel` | 风险等级 | 110 | none | center | sortable:Y | filter:numberRange | render: badge(1-5)

**周转信息（分组表头：Flow）** 18. `inboundAt` | 入库时间 | 160 | none | left | sortable:Y | filter:dateRange | render: datetime 19. `lastMoveAt` | 最后移动 | 160 | none | left | sortable:Y | filter:dateRange | render: datetime 20. `expireAt` | 效期 | 160 | none | left | sortable:Y | filter:dateRange | render: datetime + risk highlight

**业务补充（分组表头：Meta）** 21. `id` | 行ID | 160 | none | left | sortable:N | filter:textContains | render: monospace

**操作（分组表头：Actions）** 22. `opView` | 查看 | 90 | fixed:right | center | sortable:N | filter:none | render: button 23. `opCopySku` | 复制SKU | 110 | fixed:right | center | sortable:N | filter:none | render: button

> 说明：默认列此处只列到 23，是为了把“扩展列槽位”留给 30/60/120 切换。
> 实现要求：当列规模=30 时，补齐 24~30 为“扩展-基础”列（见下一节）。

### B. 扩展列

**扩展-基础（用于补齐到 30）** 24. `extText1` | 扩展文本1 | 140 | none | left | sortable:N | filter:textContains 25. `extText2` | 扩展文本2 | 140 | none | left | sortable:N | filter:textContains 26. `extEnum1` | 扩展枚举1 | 120 | none | center | sortable:Y | filter:enumIn 27. `extEnum2` | 扩展枚举2 | 120 | none | center | sortable:Y | filter:enumIn 28. `extNum1` | 扩展数值1 | 120 | none | right | sortable:Y | filter:numberRange 29. `extNum2` | 扩展数值2 | 120 | none | right | sortable:Y | filter:numberRange 30. `extDate1` | 扩展日期1 | 160 | none | left | sortable:Y | filter:dateRange

**扩展-压力（用于 60/120）**

- `extText3..extText20`（文本列，宽 140，textContains）
- `extEnum3..extEnum20`（枚举列，宽 120，enumIn）
- `extNum3..extNum40`（数值列，宽 120，numberRange）
- `extDate2..extDate20`（日期列，宽 160，dateRange）

生成规则见 `MOCK-SPEC.md`。

### C. 组合特性要求（inventory）

- `groupedHeader`：至少 3 层表头（建议：Quantity 下再分 OnHand/Available/Reserved 为一层）
- `fixedCols`：固定 left 2 列（sku、skuName），fixed right 2 列（available、操作区至少 1 列）
- `merge`：开启时按 `sku+batch` 连续行合并 sku/skuName/batch 三列

---

## /tree — 库位/批次树表

### 默认列（6）

1. `name` | 节点名称 | 260 | fixed:left | left | sortable:N | filter:textContains | render: tree indent + icon
2. `type` | 类型 | 120 | none | center | sortable:Y | filter:enumIn | render: tag
3. `availableSum` | 可用合计 | 140 | none | right | sortable:Y | filter:numberRange
4. `expireAtMin` | 最早效期 | 170 | none | left | sortable:Y | filter:dateRange | render: datetime
5. `level` | 层级 | 90 | none | center | sortable:Y | filter:numberRange
6. `opLocate` | 定位库存 | 120 | fixed:right | center | sortable:N | filter:none | render: button (跳转 /inventory 并带 filters)

---

## /picking — 波次拣货工作台

### 左表：可拣库存（建议与 /inventory 复用列的一部分）

- 必须列：`sku, skuName, batch, bin, available, qualityStatus, expireAt`
- 固定列：左固定 sku/skuName
- 选择：多选（selection 开关）

### 右表：拣货明细（强编辑）

**来源信息（Source）**

1. `sku` | SKU | 140 | fixed:left | left | sortable:N | filter:none
2. `skuName` | 名称 | 220 | fixed:left | left | sortable:N | filter:none | render: ellipsis+tooltip
3. `batch` | 批次 | 140 | none | left | sortable:N | filter:none
4. `bin` | 库位 | 140 | none | left | sortable:N | filter:none
5. `available` | 可用 | 110 | none | right | sortable:N | filter:none

**拣货信息（Pick / Editable）** 6. `pickQty` | 拣货数量 | 140 | none | right | sortable:N | filter:none | editor:number | validate: required, 0<pickQty<=available 7. `picker` | 拣货人 | 180 | none | left | sortable:N | filter:none | editor:remoteSelect | validate: required + asyncCheck 8. `strategy` | 策略 | 140 | none | center | sortable:N | filter:none | editor:select(FIFO/FEFO/MANUAL/ZONE_FIRST) | onChange: recompute (rule) 9. `remark` | 备注 | 220 | none | left | sortable:N | filter:none | editor:textarea

**状态信息（State）** 10. `rowStatus` | 状态 | 120 | none | center | sortable:Y | filter:enumIn | render: badge(clean/dirty/validating/error/ready/submitted) 11. `errors` | 错误 | 260 | none | left | sortable:N | filter:none | render: first error + tooltip list

**操作（Actions）** 12. `opEdit` | 编辑 | 90 | fixed:right | center | render: button(编辑/保存/取消) 13. `opUndo` | 撤销 | 90 | fixed:right | center | render: button(撤销)

> 扩展列（可选）：`pickedQty`、`waveId`、`taskId`、`createdAt` 用于贴近真实业务，但不影响核心对比。

---

## /exceptions — 异常处理

### 默认列（12）

1. `type` | 异常类型 | 140 | fixed:left | center | sortable:Y | filter:enumIn | render: tag
2. `sku` | SKU | 140 | fixed:left | left | sortable:Y | filter:textContains
3. `skuName` | 名称 | 220 | none | left | sortable:N | filter:textContains | render: ellipsis+tooltip
4. `bin` | 库位 | 140 | none | left | sortable:Y | filter:textContains
5. `riskLevel` | 风险 | 110 | none | center | sortable:Y | filter:numberRange | render: badge(1-5)
6. `status` | 状态 | 120 | none | center | sortable:Y | filter:enumIn | render: tag(OPEN/PROCESSING/DONE)
7. `assignee` | 处理人 | 140 | none | left | sortable:N | filter:textContains
8. `createdAt` | 创建时间 | 170 | none | left | sortable:Y | filter:dateRange | render: datetime
9. `message` | 描述 | 320 | none | left | sortable:N | filter:textContains | render: ellipsis+tooltip
10. `opProcess` | 标记处理中 | 140 | fixed:right | center | render: button
11. `opAssign` | 转派 | 100 | fixed:right | center | render: button
12. `opDetail` | 100 | 查看详情 | fixed:right | center | render: button (打开 Drawer)

### Drawer 表单字段（非表格列，但统一规格）

- `assignee`：remoteSelect（mock）
- `remark`：textarea
- `result`：select（已处理/无法处理/需复核）
