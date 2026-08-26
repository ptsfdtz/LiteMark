# LiteMark 2.1.9

LiteMark 2.1.9 improves Agent recovery and makes project file-tree updates reliable.

## Fixes and improvements

- Repaired interrupted Agent tool-call history before the next request, preventing invalid-message 400 errors.
- Agent-created project files now stay in the project explorer instead of replacing the active document as standalone files.
- Directories containing the active file can always be collapsed after the initial automatic reveal.
- Refreshing, creating, deleting, or renaming project entries preserves already loaded folder contents and refreshes only the affected directory.

## Reliability

- Added regression coverage for interrupted Agent calls, collapsible active-file directories, and incremental directory-tree updates.
- Passed version checks, frontend quality checks, the full frontend test suite, and Rust tests.

## Downloads

Download the package for your platform from the Assets section below. Builds are provided for Windows, Linux, Intel Mac, and Apple Silicon Mac.

---

# LiteMark 2.1.9 中文说明

LiteMark 2.1.9 改进了 Agent 中断恢复，并修复项目文件树更新的可靠性问题。

## 修复与改进

- 在下一次请求前修复中断的 Agent 工具调用历史，避免无效消息导致的 400 错误。
- Agent 在项目内创建的文件只保留在项目文件栏中，不再作为单文件替换当前文档。
- 当前文件所在目录在首次自动定位后仍可随时手动折叠。
- 刷新、新建、删除或重命名项目内容时，会保留已加载的目录树，并只刷新受影响的目录。

## 稳定性验证

- 新增 Agent 中断调用、当前文件目录折叠以及增量目录树更新的回归测试。
- 已通过版本一致性检查、前端质量检查、完整前端测试和 Rust 测试。

## 下载

请在下方 Assets 区域下载对应平台的安装包或压缩包。本版本提供 Windows、Linux、Intel Mac 和 Apple Silicon Mac 构建。
