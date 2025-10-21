# 🪶 LiteMark

> 一个基于 [Tauri](https://tauri.app/) 构建的**轻量级**、**极速**、**现代化** Markdown 编辑器 —— 更小内存占用，更专注写作。


## 🌙 主题演示

LiteMark 支持浅色和深色两种主题，适应不同环境下的写作体验。

| Cadmium Light 主题 | Dark 主题 |
| :----------------: | :-------: |
| <img src="https://github.com/ptsfdtz/litemark/assets/preview-light.png" width="480" alt="LiteMark 浅色主题预览"> | <img src="https://github.com/ptsfdtz/litemark/assets/preview-dark.png" width="480" alt="LiteMark 深色主题预览"> |

---

## ✨ 功能特性

- ⚡ **轻量 & 极速** — 基于 Tauri，启动毫秒级，无 Electron 臃肿。
- 🧘 **极简界面** — 专注写作，极简无干扰。
- 🪶 **实时预览** — Markdown 实时渲染，排版美观。
- 💾 **自动保存** — 草稿永不丢失。
- 🌙 **深色/浅色模式** — 跟随系统主题自动切换。
- 🧩 **跨平台** — 支持 Windows、macOS、Linux。

---

## ❓为什么要做？

1. 之前做过 Electron 项目，发现体积太大，安装包和运行包都很臃肿。Tauri 利用系统 webview，能做出小巧精致的桌面应用。
2. 市面上的 Markdown 编辑器要么太大（如 MarkText、Joplin），要么不够简洁，或者没有离线桌面版（如 StackEdit）。
3. 作为练手和兴趣，打造一个自己理想的 Markdown 编辑器。

## 🚀 安装

### 🧱 预编译版本
前往 [Releases](https://github.com/ptsfdtz/litemark/releases) 页面下载适合你系统的最新版。

### 🛠 源码构建

```bash
# 克隆仓库
git clone https://github.com/ptsfdtz/litemark.git
cd litemark

# 安装依赖
pnpm install   # 或 npm / yarn

# 开发模式运行
pnpm tauri dev

# 构建生产包
pnpm tauri build
```

---

## 🧩 技术栈

| 层级            | 技术                                      |
| --------------- | ----------------------------------------- |
| 桌面运行时      | [Tauri](https://tauri.app/)               |
| 前端            | React + TypeScript                        |
| 样式            | CSS Modules / 部分原生 CSS                |
| Markdown 解析   | remark / rehype / remark-gfm / remark-math|
| 用户引导        | react-joyride                             |

---

## 🧑‍💻 作者

**童浩然 (ptsfdtz)**

* 💼 [GitHub @ptsfdtz](https://github.com/ptsfdtz)
* ✈️ 热爱极简软件、开源和干净的 UI 设计。

---

⭐ **如果你喜欢这个项目，欢迎 star 支持！**
