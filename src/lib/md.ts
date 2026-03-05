import { marked } from "marked"
import TurndownService from "turndown"

export const DRAFT_KEY = "litemark.draft.md"

export const DEFAULT_MD = `# LiteMark

在这里直接输入内容，编辑区就是预览效果。

- 输入 \`# 空格\` 自动变标题
- 输入 \`- 空格\` 自动变列表
- 输入 \`> 空格\` 自动变引用

\`\`\`ts
console.log("hello markdown")
\`\`\`
`

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
})

export function mdToHtml(markdown: string): string {
  return marked.parse(markdown) as string
}

export function htmlToMd(html: string): string {
  return turndown.turndown(html)
}

export function downloadMd(markdown: string, fileName = "note.md") {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("读取文件失败"))
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.readAsText(file)
  })
}
