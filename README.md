
# 🪶 LiteMark

> A **lightweight**, **fast**, and **modern** Markdown editor built with [Tauri](https://tauri.app/) — less memory, more focus.

<p align="center">
  <img src="assets/preview.png" width="600" alt="LiteMark Preview">
</p>

## 🌙themes🔆

| **Cadmium Light**	 | **Dark** |
## 🌙 Themes

LiteMark supports both light and dark modes for a comfortable writing experience in any environment.

| Cadmium Light Theme | Dark Theme |
| :-----------------: | :--------: |
| <img src="assets/preview-light.png" width="480" alt="LiteMark Light Theme Preview"> | <img src="assets/preview-dark.png" width="480" alt="LiteMark Dark Theme Preview"> |

---

## ✨ Features

- ⚡ **Lightweight & Fast** — built with Tauri, startup in milliseconds, no Electron bloat.
- 🧘 **Minimal UI** — distraction-free writing environment, perfect for focus.
- 🪶 **Live Preview** — instant Markdown rendering with clean typography.
- 💾 **Auto Save** — your drafts are never lost.
- 🌙 **Dark / Light Mode** — switch seamlessly to match your system theme.
- 🧩 **Cross-platform** — works on Windows, macOS, and Linux.

---

## ❓Why make it ?

1. First, I've created an `Electron` project before, and I find it incredibly large, both in terms of installation size and package size. As a developer, I'm not a fan of such frameworks. Thanks to `Tauri` for using the system's webview, I was able to create a small and beautiful app.
2. Secondly, all the `Markdown editors` on the market have some minor issues, the biggest being their use of Electron. `MarkText`, which uses the Electron framework, is incredibly large, `Joplin` also uses the Electron framework and lacks simplicity, `Visual Studio Code` is for writing code, and `StackEdit` doesn't have a desktop offline version.
3. Therefore, to hone my coding skills and out of my passion for this field, I created this editor.

--- 

## 🚀 Installation

### 🧱 Prebuilt binaries
Check the [Releases](https://github.com/ptsfdtz/litemark/releases) page to download the latest version for your OS.

### 🛠 Build from source

```bash
# Clone
git clone https://github.com/ptsfdtz/litemark.git
cd litemark

# Install dependencies
pnpm install   # or npm / yarn

# Run in dev mode
pnpm tauri dev

# Build production
pnpm tauri build
````

---

## 🧩 Tech Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Desktop Runtime  | [Tauri](https://tauri.app/)                     |
| Frontend         | React + TypeScript                              |
| Styling          | CSS Modules / 部分原生 CSS                      |
| Markdown Parsing | remark / rehype / remark-gfm / remark-math      |
| Guided Experience| react-joyride                                   |

---

## 🧑‍💻 Author

**Haoran Tong (ptsfdtz)**

* 💼 [GitHub @ptsfdtz](https://github.com/ptsfdtz)
* ✈️ Passionate about minimal software, open source, and clean UI design.

---

⭐ **Star this repo if you love minimal tools!**

[🇨🇳 中文版说明](./README.zh-CN.md)
