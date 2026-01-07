# `.editorconfig` vs `.gitattributes`（区别与配合）

## 定位一句话

- `.editorconfig`：约束“编辑器/IDE 如何写文件”（缩进、编码、行尾、去除行尾空白等）。
- `.gitattributes`：约束“Git 如何处理文件”（文本/二进制判定、行尾规范化、diff/merge、过滤器等）。

两者关注点不同，但都能影响“行尾看起来是什么样”，因此经常一起使用。

## 生效时机（关键区别）

- `.editorconfig`：主要在**你编辑/保存文件**时生效（取决于编辑器/插件是否支持）。
- `.gitattributes`：在**Git 检出/加入索引/提交**等流程中生效（与编辑器无关，属于版本控制层）。

## 作用范围与能力对比

### `.editorconfig` 能做什么

- 统一缩进：`indent_style`、`indent_size`
- 统一编码：`charset`
- 统一行尾与文件末尾换行：`end_of_line`、`insert_final_newline`
- 控制保存时行为：`trim_trailing_whitespace`
- 以文件类型做差异化规则（例如 `*.md`、`*.json`）

限制：它不改变 Git 的存储方式；不保证每个开发者都安装/启用 EditorConfig 支持。

### `.gitattributes` 能做什么

- 指定文本/二进制与行尾规范化：`text`、`eol`
- 定制 diff/merge/合并策略：`diff`、`merge`
- 过滤器与 LFS：`filter`
- 导出行为等：`export-ignore` 等

优势：属于 Git 行为，团队一致性更强；尤其适合解决跨平台换行导致的“全文件被改”的噪音 diff。

## 本项目里的配合关系（以当前配置为例）

### 行尾（LF）是一致的

- `.gitattributes`：`* text=auto eol=lf`（文本文件检出为 LF，提交时规范化）
- `.editorconfig`：`[*] end_of_line = lf`（编辑器保存时写 LF）

因此在本项目里，两者是“同向约束”：编辑器写出来是 LF，Git 也要求检出/规范化为 LF，能最大限度减少换行差异。

### Markdown 的“行尾空白”处理不同侧重点

`.editorconfig` 对 `*.md` 设置 `trim_trailing_whitespace = false`，是为了保留 Markdown 语义（行尾两个空格换行）。这属于“编辑体验/内容语义”层面的策略；`.gitattributes` 通常不负责这类细节。

## 常见误区

- 只配 `.editorconfig` 不配 `.gitattributes`：编辑器能写得一致，但 Git 仍可能因为各人 `core.autocrlf` 不同而产生换行噪音。
- 只配 `.gitattributes` 不配 `.editorconfig`：Git 能规范化，但开发者本地编辑时仍可能出现不一致（例如缩进、行尾空白），影响 review 体验。
- 以为两者互相覆盖：它们不在同一层面。“保存时写什么”与“Git 如何存储/检出”是两条链路；最好让两者对关键项（如 EOL）保持一致。

## 自查方法（可选）

- 查看 Git 属性是否生效：`git check-attr -a -- path/to/file`
- 查看 EditorConfig 是否生效：检查编辑器/IDE 是否启用了 EditorConfig 支持，并观察保存时的缩进/行尾/去空白行为

