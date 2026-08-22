# LiteMark 2.1.3

LiteMark 2.1.3 is a focused maintenance release that improves Markdown image rendering, file-explorer consistency, and editor stability.

## Fixes and improvements

- Fixed HTML `<img>` elements inside GFM table cells disappearing in the WYSIWYG editor.
- Resolved relative local image paths against the current Markdown document in both editor and preview modes.
- Preserved the original Markdown image source while using Tauri asset URLs only for display.
- Fixed a full-window blank screen that could occur after closing the final open file.
- Kept one stable editor instance while files are opened, switched, or closed.
- Unified standalone-file rows with folder-root rows in the file explorer, including height, spacing, selection background, hover state, and remove-button behavior.
- Removed the white gap previously shown beside an active standalone file row.

## Reliability

- Added regression coverage for HTML table images and changing or clearing the active document path.
- Verified that image rendering and closing the final file do not modify Markdown content.
- Verified the final-file close workflow in a real Tauri desktop window.
- Passed formatting, linting, style, TypeScript, frontend tests, Rust tests, and production build validation.

## Downloads

Download the package for your platform from the Assets section below. Builds are provided for Windows, Linux, Intel Mac, and Apple Silicon Mac.

---

# LiteMark 2.1.3 中文说明

LiteMark 2.1.3 是一次专注于 Markdown 图片渲染、文件目录一致性和编辑器稳定性的维护版本。

## 修复与改进

- 修复 GFM 表格单元格中的 HTML `<img>` 图片在所见即所得编辑器中消失的问题。
- 编辑器和预览模式现在都会基于当前 Markdown 文件目录解析本地相对图片路径。
- 渲染时仅在展示层使用 Tauri 资源地址，Markdown 文件中继续保留原始相对路径。
- 修复关闭最后一个已打开文件后整个窗口变成空白的问题。
- 打开、切换和关闭文件时保持同一个稳定的编辑器实例。
- 统一左侧单文件与文件夹根项目的行高、间距、选中背景、悬停状态和移除按钮行为。
- 修复单文件选中背景右侧出现白色断层的问题。

## 稳定性验证

- 新增表格 HTML 图片以及活动文档路径切换和清空的回归测试。
- 验证图片渲染和关闭最后一个文件不会修改 Markdown 内容。
- 已在真实 Tauri 桌面窗口中验证关闭最后文件的完整流程。
- 已通过格式、Lint、Stylelint、TypeScript、前端测试、Rust 测试和生产构建检查。

## 下载

请在下方 Assets 区域下载对应平台的安装包或压缩包。本版本提供 Windows、Linux、Intel Mac 和 Apple Silicon Mac 构建。
