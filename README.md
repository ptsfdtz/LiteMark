# 🪶 LiteMark

> ✍️ **LiteMark** is a **lightweight**, **fast**, and **modern Markdown editor** built with **Tauri** — less memory, more focus, no Electron bloat.

<p align="center">
  <img src="assets/preview.png" width="640" alt="LiteMark Preview">
</p>

---

## 🌙 Themes 🔆

LiteMark supports both **light** and **dark** themes for a comfortable writing experience in any environment.

|                                    Cadmium Light                                    |                                        Dark                                       |
| :---------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------: |
| <img src="assets/preview-light.png" width="480" alt="LiteMark Light Theme Preview"> | <img src="assets/preview-dark.png" width="480" alt="LiteMark Dark Theme Preview"> |

---

## ✨ Features

* ⚡ **Lightweight & Fast**
  Built with **Tauri**, launches in milliseconds with minimal memory usage.

* 🧘 **Minimal UI**
  A distraction-free writing environment designed for focus.

* 🪶 **Live Preview**
  Instant Markdown rendering with clean, readable typography.

* 💾 **Auto Save**
  Your drafts are automatically saved — no fear of losing work.

* 🌙 **Dark / Light Mode**
  Seamlessly adapts to your system theme.

* 🧩 **Cross-platform**
  Available on **Windows**, **macOS**, and **Linux**.

---

## ❓ Why LiteMark?

I created **LiteMark** for three simple reasons:

1. **Electron is too heavy**
   I’ve built Electron apps before, and the large bundle size and memory usage always felt excessive.
   With **Tauri** leveraging the system WebView, I was finally able to build a **small, fast, and beautiful** desktop app.

2. **Existing Markdown editors didn’t feel right**

   * **MarkText** and **Joplin** are Electron-based and relatively heavy
   * **VS Code** is great for coding, but overkill for writing
   * **StackEdit** lacks an offline desktop experience

3. **Passion & craftsmanship**
   LiteMark is a personal project driven by my love for minimal software, clean UI, and open source — and a way to continuously sharpen my engineering skills.

---

## 🚀 Installation

### 🧱 Prebuilt Binaries

Download the latest release for your OS from the
👉 **[Releases](https://github.com/ptsfdtz/litemark/releases)** page.

### 🛠 Build from Source

```bash
# Clone the repository
git clone https://github.com/ptsfdtz/litemark.git
cd litemark

# Install dependencies
pnpm install   # or npm / yarn

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

---

## 🧩 Tech Stack

| Layer              | Technology                                 |
| ------------------ | ------------------------------------------ |
| Desktop Runtime    | Tauri                                      |
| Frontend           | React + TypeScript                         |
| Styling            | CSS Modules / Partial native CSS           |
| Markdown Rendering | remark / rehype / remark-gfm / remark-math |
| Guided Experience  | react-joyride                              |

---

## 🧑‍💻 Author

**Haoran Tong (ptsfdtz)**

* 💼 GitHub: [https://github.com/ptsfdtz](https://github.com/ptsfdtz)
* ✈️ Passionate about **minimal software**, **open source**, and **clean UI design**

---

⭐ **If you enjoy minimal tools and fast apps, consider starring this repo!**

📖 **[🇨🇳 中文说明](./README.zh-CN.md)**