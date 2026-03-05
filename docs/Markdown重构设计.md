# Markdown 重构设计

## 目标

1. 支持稳定渲染：标题、列表、代码块、表格、引用、任务列表。
2. 保证安全：默认无高危 XSS。
3. 提供可扩展插件机制：TOC、代码高亮、数学公式可选。

## 当前状态

1. 已接入 TipTap，编辑区即预览区（MVP 链路已落地）。
2. Markdown/HTML 双向转换基于 `marked` + `turndown`，尚未接入 sanitize。
3. 插件体系与安全策略尚未实现，仍依赖基础渲染。

## 目标架构

```text
Editor Input
  -> preprocessors
  -> remark plugins
  -> rehype plugins
  -> sanitize
  -> React renderer
```

## 渲染规范

默认启用：
1. `remark-gfm`
2. `remark-math`（可选）
3. `rehype-highlight`（可选）
4. `rehype-katex`（可选）

默认禁用：
1. `rehype-raw`（除非显式开启且有 sanitize）

## 安全策略

1. 链接协议白名单：`https/http/mailto/file/asset/tauri`。
2. 外链统一 `target="_blank"` + `rel="noopener noreferrer nofollow"`。
3. 禁止 `javascript:`、`vbscript:`、危险 `data:` 链接。
4. 若允许 raw HTML，必须串联 `rehype-sanitize`。

## 模式一致性

1. 编辑态：仅编辑器可交互。
2. 预览态：仅预览可滚动。
3. 分屏态：编辑与预览同时渲染并支持滚动同步。

统一规则：
1. 模式切换不丢失光标与滚动上下文。
2. 保存快捷键在三种模式下行为一致。

## 插件接口（建议）

```ts
export interface MarkdownPlugin {
  name: string;
  enabledByDefault: boolean;
  setup: (ctx: MarkdownPipelineContext) => void;
}
```

## 测试计划

1. 语法正确性用例 >= 60 条。
2. 安全攻击样例 >= 20 条。
3. 模式切换行为用例 >= 15 条。

## 回滚策略

1. 使用 `markdown_pipeline_v2` 开关控制新链路。
2. 若线上异常，切回 legacy 渲染。
