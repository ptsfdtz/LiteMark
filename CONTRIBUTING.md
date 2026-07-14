## 欢迎贡献

感谢你对 LiteMark 的关注！欢迎任何形式的贡献：Bug 报告、功能建议、代码改进或文档完善。

在开始之前，请先阅读下面的本地开发与提交流程，能加速你的贡献被合并。

---

## 1. 准备开发环境

- 操作系统：建议使用 Windows / macOS / Linux 中任意一款现代发行版。
- Node.js：使用 Node.js 20.19+、22.12+ 或 24.x。项目固定使用 `pnpm 11.7.0` 管理依赖。
- Rust / Tauri：若要运行原生桌面版本或打包，请安装 `rustup`。仓库根目录的 `rust-toolchain.toml` 会自动选择所需工具链，Tauri CLI 已作为项目依赖提供。

安装依赖（项目根目录）：

```powershell
# Node.js 自带 Corepack 时，可先运行：corepack enable
pnpm install
```

---

## 2. 常用开发命令

- 启动开发服务器（前端热重载）：

```powershell
pnpm dev
```

- 启动 Tauri 原生开发（该命令会自动启动 Vite）：

```powershell
pnpm tauri dev
```

- 打包发布（Web/桌面）：

```powershell
# 构建前端并打包
pnpm build
pnpm tauri build
```

---

## 3. 代码样式、Lint 与格式化

- 格式化：项目使用 `prettier`，可运行：

```powershell
pnpm format
```

- ESLint / Stylelint：

```powershell
pnpm lint
pnpm stylelint
```

- 运行全部只读检查（格式、Lint、类型检查与测试）：

```powershell
pnpm check
```

- 单次运行测试或启动测试监听：

```powershell
pnpm test
pnpm test:watch
```

- 提交前钩子：项目已配置 `husky` 与 `lint-staged`，提交时会自动运行格式化与部分检查。

---

## 4. 编辑器与关键实现说明（开发者快速上手）

以下为对项目中重要实现点的总结，便于理解代码并定位修改位置。

- 编辑器：项目已替换为 Monaco Editor（文件：`src/components/Editor/Editor.tsx`）。注意：
	- 快捷键（如 Ctrl+S / Ctrl+Shift+S）通过 Monaco 的 `addCommand` 绑定，并且组件内部使用 `useRef` 保持最新的 `onSave` / `onSaveAs` 回调以避免闭包问题。
	- 若需要修改编辑器行为（缩进、快捷键、键盘命令），请在 `Editor.tsx` 的 `onMount` 回调中调整或注册新命令。

- 工具栏：工具栏和 Monaco 快捷键共同通过 `src/modules/markdownEditing/applyMarkdownTransform.ts` 调用 `executeEdits`，以保留撤销栈。

- 滚动同步：由 `src/components/Layout/Layout.tsx` 将 Monaco 与预览区的滚动比例映射集中管理。

- 主题切换：主题（light/dark/system）由 `data-theme` 属性驱动，切换时使用 View Transition API，实现在 `src/components/Layout/Layout.tsx`。

- 启动打开文件：桌面端通过系统传入的启动参数打开文件，后端命令 `get_startup_file` 解析路径，前端 Document Session module 在 ready 前加载该文档。

- 本地图片加载：Markdown 预览会根据当前文件路径解析图片相对路径，并通过 `convertFileSrc` 加载本地图片（`src/components/Preview/Preview.tsx`）。需确保 `src-tauri/tauri.conf.json` 中 `app.security.assetProtocol` 已启用且 `scope` 覆盖图片所在目录。

---

## 5. 提交与 PR 规范

- 分支：使用 feature 分支开发，分支命名建议 `feat/xxx`、`fix/xxx`、`chore/xxx`。
- 提交信息：遵循简洁描述，建议采用 Conventional Commits 风格（例如：`feat(editor): add minimap toggle`）。
- Pull Request：
	- 先在 issue 中说明要做的修改（若是大改动），并在 PR 描述中列出变更内容与影响范围。
	- 确保 PR 中无破坏性变更或未清理的调试代码。
	- 若涉及 UI 变更，请附上前后对比截图。
	- CI / 本地 lint/format 应通过。
	- 若影响 Tauri 打包（如文件关联/权限），请说明平台验证情况。

---

## 6. 测试与调试常见问题

- 无法编译或依赖安装出错：先验证固定 lockfile；不要删除 `pnpm-lock.yaml`：

```powershell
pnpm install --frozen-lockfile
pnpm check
```

- Monaco 相关问题：若编辑器无法加载或出现跨域/worker 错误，检查 `monaco-editor` 版本与 `@monaco-editor/react` 配置。一般在 dev 模式下直接 `pnpm dev` 可重现问题并调试。

- Tauri 构建失败：检查 Rust toolchain 与 Tauri 版本是否匹配，查看 `src-tauri/tauri.conf.json` 与 `Cargo.toml`。

- 本地图片不显示：确认 `app.security.assetProtocol` 已启用，`scope` 覆盖图片路径（例如 `$HOME/**`），并重启 `pnpm tauri dev` 或重新打包安装。

- 文件关联不生效：仅安装后的桌面包会注册默认应用，修改 `bundle.fileAssociations` 后需重新打包并安装。

---

## 7. 报告 Bug / 提出建议

- 如果发现 bug，请提供尽可能详细的信息：重现步骤、环境（OS、Node、pnpm、Tauri 版本）、控制台日志与截图。
- 小的修复可直接提交 PR；大的设计变更请先开 issue 讨论。

---

## 8. 额外资源与联系方式

- 项目仓库 issues：用于跟踪 bug 与功能需求。
- 联系方式：在 issue 中 @ 提相关维护者或在项目 README 中查找联系方式。

---

## 项目目录结构（快速参考）

下面给出项目的主要文件与目录的扁平化视图（摘录），以及每个重要目录的作用，方便快速定位代码和实现。

```
litemark/
├─ eslint.config.cjs
├─ index.html
├─ LICENSE
├─ package.json
├─ pnpm-lock.yaml
├─ README.md
├─ README.zh-CN.md
├─ tsconfig.json
├─ vite.config.ts
├─ assets/                # 静态资源
├─ public/                # 公共静态文件
├─ src/                   # 前端源码（React + TypeScript）
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ App.css
│  ├─ vite-env.d.ts
│  ├─ components/
│  │  ├─ Editor/         # 编辑器组件（现在使用 Monaco）
│  │  │  ├─ Editor.tsx
│  │  │  └─ Editor.module.css
│  │  ├─ Layout/         # 主布局、分栏、设置面板、保存提示等
│  │  │  ├─ Layout.tsx
│  │  │  └─ components/
│  │  │     ├─ CurrentFileName.tsx
│  │  │     └─ SaveSuccessToast.tsx
│  │  ├─ Preview/        # Markdown 预览 + math preprocess
│  │  ├─ Toolbar/        # 编辑命令工具栏
│  │  ├─ Settings/       # 设置面板
│  │  └─ RecentFilesSidebar/
│  ├─ modules/           # Document Session、Markdown Editing 与窗口关闭保护模块
│  ├─ types/             # TypeScript 类型声明
│  └─ utils/             # 本地存储、工作目录、recent store 等
├─ src-tauri/             # Tauri 原生相关（Rust + 配置）
│  ├─ build.rs
│  ├─ Cargo.toml
│  ├─ tauri.conf.json
│  ├─ src/                # Rust 适配层与 Document Storage module
│  └─ icons/              # 平台图标
└─ target/                # Tauri / Rust 构建产物（忽略、由构建生成）

```

要点提示：
- 编辑器代码位于 `src/components/Editor/Editor.tsx`，Monaco 的配置、快捷键注册、以及与外部 `onSave`/`onSaveAs` 的绑定都在这里。
- 主布局与主题切换逻辑在 `src/components/Layout/Layout.tsx`，其中包含对 `data-theme` 的设置与 View Transition 的调用。
- Markdown 渲染和预览在 `src/components/Preview`，数学公式预处理在其 hooks 中。
- Document Session interface 位于 `src/modules/documentSession`；本地文件系统 implementation 位于 `src-tauri/src/document_storage.rs`。
