# My Markdown Editor

这是一个基于 **React + TypeScript + Tauri** 的 Markdown 编辑器项目。

## 功能列表

### 核心功能
- [x] 左侧文件浏览 (Sidebar)
- [x] 中间 Markdown 编辑区 (Editor)
- [x] 实时渲染预览 (Preview)
- [x] 顶部 Markdown 工具栏 (Toolbar)
- [x] 设置面板 (Setting)：
  - [x] 主题切换（明暗模式）
  - [x] 默认工作文件夹

### 文件操作
- [ ] 新建 / 保存 / 另存为 Markdown 文件
- [ ] 文件重命名 / 删除
- [ ] 最近打开文件列表
- [ ] 导出 PDF / HTML

### 编辑体验
- [ ] Undo / Redo
- [ ] 自动保存
- [ ] 搜索 / 替换
- [ ] 多标签编辑

### Markdown 渲染增强
- [ ] 代码高亮
- [ ] 表格 / 数学公式 / 流程图
- [ ] 折叠标题 / 段落
- [ ] 渲染主题切换（自定义样式）

### 用户界面优化
- [ ] 可拖动分栏
- [ ] 全屏模式
- [ ] 快捷键支持
- [ ] 状态栏（显示文件路径、字数、光标行列）

### 高级功能（可选）
- [ ] Markdown 模板
- [ ] 插件机制
- [ ] 云同步
- [ ] 多平台导出（PDF、HTML、DOCX）

## 项目结构
```
my-markdown-editor/
├─ node_modules/                     # npm 依赖
├─ public/                           # 静态资源（favicon、logo 等）
├─ src/
│  ├─ components/
│  │  ├─ Sidebar/
│  │  │   ├─ Sidebar.tsx
│  │  │   └─ Sidebar.css
│  │  ├─ Editor/
│  │  │   ├─ Editor.tsx
│  │  │   └─ Editor.css
│  │  ├─ Preview/
│  │  │   ├─ Preview.tsx
│  │  │   └─ Preview.css
│  │  ├─ Toolbar/
│  │  │   ├─ Toolbar.tsx
│  │  │   └─ Toolbar.css
│  │  ├─ Layout/
│  │  │   ├─ Layout.tsx
│  │  │   └─ Layout.css
│  │  └─ Setting/
│  │      ├─ Setting.tsx
│  │      └─ Setting.css
│  ├─ types/
│  │  ├─ file.ts                     # 文件/目录类型
│  │  ├─ markdown.ts                 # Markdown 类型
│  │  └─ tauri.d.ts                  # Tauri 命令返回类型
│  ├─ utils/
│  │  └─ markdownHelpers.ts          # Markdown 快捷操作函数
│  ├─ App.tsx                        # 顶层组件
│  ├─ main.tsx                        # React 入口，挂载 Layout
│  └─ index.css                       # 全局样式 + CSS 变量
├─ src-tauri/
│  ├─ icons/                          # 可删除示例图标
│  ├─ Cargo.toml                       # Rust 包配置
│  ├─ main.rs                          # Tauri 后端入口
│  └─ tauri.conf.json                  # Tauri 配置文件
├─ package.json                        # npm 配置
├─ tsconfig.json                       # TypeScript 配置
├─ vite.config.ts                       # Vite 配置
└─ README.md
```


## 技术栈

- React + TypeScript
- Tauri (Rust + 前端)
- Markdown 渲染库：`react-markdown` 或 `markdown-it`
- CSS 模块化 / 变量支持主题切换



