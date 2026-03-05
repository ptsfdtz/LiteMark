# Markdown 重构设计

## 1. 目标

1. 提升语法正确性（标题、列表、代码块、表格、引用、任务列表）到 >=99%。
2. 建立默认安全策略，阻断高危 XSS。
3. 建立插件机制，支持 TOC、高亮、数学公式可插拔。
4. 保证编辑态/预览态/分屏态行为一致。

## 2. 现状问题

1. 当前启用了 `rehypeRaw`，但未串联 `rehype-sanitize`，存在注入风险。
2. 高亮流程同时使用 `rehype-highlight` 与手动 `highlight.js` 二次处理，逻辑重复。
3. 数学预处理与渲染耦合在组件内，难以测试。
4. 缺少语法回归用例和安全攻击样例。

## 3. 目标架构

```text
Markdown Source
  -> preprocessors (optional)
  -> remark plugins (gfm/math/emoji/toc)
  -> rehype plugins (sanitize/highlight/katex)
  -> render adapters (react components)
```

模块拆分：
1. `shared/markdown/core.ts`：创建统一处理管线。
2. `shared/markdown/security.ts`：白名单、URL 策略、target/rel 策略。
3. `shared/markdown/plugins/*`：插件注册与配置。
4. `shared/markdown/types.ts`：插件接口与配置类型。

## 4. 模式一致性规范

三种模式：
1. 编辑态（Editor Only）
2. 预览态（Preview Only）
3. 分屏态（Split View）

统一规则：
1. 工具栏行为一致，禁用态由模式控制，不由组件自行判断。
2. 滚动同步仅在分屏态有效，进入/退出分屏时重置同步基线。
3. 快捷键优先级固定：保存 > 模式切换 > 文本格式化。
4. 链接点击策略一致：外链新窗口，本地路径由 Tauri 协议转换。

## 5. 安全策略

默认策略：
1. 默认禁用原始 HTML（`allowRawHtml = false`）。
2. 若启用原始 HTML，必须经过 `rehype-sanitize` 且仅允许白名单标签。
3. 链接协议白名单：`https`、`http`、`mailto`、`file`、`asset`、`tauri`。
4. 外链统一 `target="_blank"` + `rel="noopener noreferrer nofollow"`。
5. 禁止 `javascript:`、未知 `data:` 类型和内联事件属性。

## 6. 插件机制

插件接口（设计）：

```ts
export interface MarkdownPlugin {
  name: string;
  enabledByDefault: boolean;
  setup: (ctx: MarkdownPipelineContext) => void;
}
```

内置插件规划：
1. `plugin-gfm`
2. `plugin-math`
3. `plugin-highlight`
4. `plugin-toc`
5. `plugin-emoji`

## 7. 测试设计

单测：
1. 语法正确性样例 >= 60 条。
2. 安全攻击样例 >= 20 条（脚本注入、协议绕过、属性注入）。
3. 插件开关组合测试 >= 15 条。

集成测试：
1. 编辑输入 -> 预览渲染快照。
2. 模式切换行为一致性。
3. 滚动同步边界测试（首行、末行、大文档）。

## 8. 迁移步骤

1. 抽离现有预处理逻辑到 `shared/markdown`。
2. 引入安全策略并替换 Preview 组件中的临时处理。
3. 加入插件注册器，逐步替换硬编码插件数组。
4. 通过特性开关灰度：`markdown_pipeline_v2`。

## 9. 回滚方案

1. 保留旧 Preview 渲染路径一段时间（`legacyMarkdownRenderer`）。
2. 若出现兼容性问题，可按配置回退旧链路。
3. 回滚后保留异常样例，补入回归测试后再推进。
