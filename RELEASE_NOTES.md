# LiteMark 2.1.7

LiteMark 2.1.7 adds signed over-the-air updates and preserves both sidebar states across app restarts.

## Fixes and improvements

- Added automatic update checks at startup. When a signed newer release is available, LiteMark offers to download, install, and restart.
- Update downloads show progress and cannot start while the current document has unsaved changes.
- The File Explorer and Agent sidebars are closed by default on first launch.
- After a user opens or closes either sidebar, LiteMark restores that choice on subsequent launches.

## Reliability

- Added updater and file-explorer visibility regression coverage.
- Passed TypeScript checks, the full frontend test suite, Rust tests, and Tauri desktop build validation.

## Downloads

Download the package for your platform from the Assets section below. Builds are provided for Windows, Linux, Intel Mac, and Apple Silicon Mac.

---

# LiteMark 2.1.7 中文说明

LiteMark 2.1.7 新增了带签名的 OTA 自动更新，并让左右侧边栏都能在重启后恢复状态。

## 修复与改进

- 启动时会自动检查更新。发现已签名的新版本后，可下载、安装并自动重启。
- 更新下载会显示进度；当前文档存在未保存修改时，不能开始更新。
- 首次启动时，文件栏和 Agent 侧边栏默认保持关闭。
- 用户手动展开或关闭任一侧边栏后，LiteMark 会在后续启动时恢复该选择。

## 稳定性验证

- 新增 OTA 更新和文件栏可见状态的回归测试。
- 已通过 TypeScript 检查、完整前端测试套件、Rust 测试和 Tauri 桌面构建验证。

## 下载

请在下方 Assets 区域下载对应平台的安装包或压缩包。本版本提供 Windows、Linux、Intel Mac 和 Apple Silicon Mac 构建。
