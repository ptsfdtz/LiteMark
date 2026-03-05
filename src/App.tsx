import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import { EditorContent, useEditor } from "@tiptap/react"
import {
  Bold,
  Code2,
  Download,
  Heading1,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  Upload,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useMarkdownStats } from "@/hooks"
import {
  DEFAULT_MD,
  DRAFT_KEY,
  downloadMd,
  htmlToMd,
  mdToHtml,
  readFileAsText,
} from "@/lib/md"
import type { MdMeta, MdToolbarAction } from "@/types/markdown-editor"

const SAVE_DELAY = 600

const ICONS = {
  h1: Heading1,
  bold: Bold,
  italic: Italic,
  ul: List,
  ol: ListOrdered,
  quote: Quote,
  code: Code2,
  undo: Undo2,
  redo: Redo2,
}

function getInitialMd(): string {
  if (typeof window === "undefined") {
    return DEFAULT_MD
  }

  const draft = window.localStorage.getItem(DRAFT_KEY)
  return draft === null ? DEFAULT_MD : draft
}

function normalizeMd(value: string): string {
  const next = value.replace(/\r\n/g, "\n").trimEnd()
  return next ? `${next}\n` : ""
}

function normalizeFileName(name: string): string {
  const next = name.trim()
  if (!next) {
    return "note.md"
  }

  return next.endsWith(".md") ? next : `${next}.md`
}

function formatSavedAt(value: string | null): string {
  if (!value) {
    return "未保存"
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}

export function App() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const saveRef = useRef<number | null>(null)
  const [md, setMd] = useState<string>(() => getInitialMd())
  const [meta, setMeta] = useState<MdMeta>({ name: "draft.md", savedAt: null })
  const [note, setNote] = useState("")

  const stats = useMarkdownStats(md)

  const queueSave = useCallback((value: string) => {
    if (saveRef.current !== null) {
      window.clearTimeout(saveRef.current)
    }

    saveRef.current = window.setTimeout(() => {
      window.localStorage.setItem(DRAFT_KEY, value)
      setMeta((prev) => ({ ...prev, savedAt: new Date().toISOString() }))
    }, SAVE_DELAY)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "输入 Markdown 语法，编辑区会直接显示渲染结果",
      }),
    ],
    content: mdToHtml(md),
    editorProps: {
      attributes: {
        class: "md-editor",
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = normalizeMd(htmlToMd(current.getHTML()))
      setMd(next)
      queueSave(next)
    },
  })

  useEffect(() => {
    return () => {
      if (saveRef.current !== null) {
        window.clearTimeout(saveRef.current)
      }
    }
  }, [])

  const canUndo = editor?.can().chain().focus().undo().run() ?? false
  const canRedo = editor?.can().chain().focus().redo().run() ?? false

  const applyMd = useCallback(
    (value: string) => {
      const next = normalizeMd(value || DEFAULT_MD)
      setMd(next)
      queueSave(next)
      if (editor) {
        editor.commands.setContent(mdToHtml(next), { emitUpdate: true })
      }
    },
    [editor, queueSave]
  )

  const onImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) {
        return
      }

      try {
        const text = await readFileAsText(file)
        applyMd(text)
        setMeta({ name: normalizeFileName(file.name), savedAt: null })
        setNote(`已导入 ${file.name}`)
      } catch (error) {
        console.error(error)
        setNote("导入失败：请确认文件编码为 UTF-8")
      }
    },
    [applyMd]
  )

  const onExport = useCallback(() => {
    const fileName = normalizeFileName(meta.name)
    downloadMd(md, fileName)
    setNote(`已导出 ${fileName}`)
  }, [md, meta.name])

  const toolbar = useMemo<MdToolbarAction[]>(() => {
    if (!editor) {
      return []
    }

    return [
      {
        key: "h1",
        title: "H1",
        active: editor.isActive("heading", { level: 1 }),
        onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        key: "bold",
        title: "粗体",
        active: editor.isActive("bold"),
        onClick: () => editor.chain().focus().toggleBold().run(),
      },
      {
        key: "italic",
        title: "斜体",
        active: editor.isActive("italic"),
        onClick: () => editor.chain().focus().toggleItalic().run(),
      },
      {
        key: "ul",
        title: "无序",
        active: editor.isActive("bulletList"),
        onClick: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        key: "ol",
        title: "有序",
        active: editor.isActive("orderedList"),
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        key: "quote",
        title: "引用",
        active: editor.isActive("blockquote"),
        onClick: () => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        key: "code",
        title: "代码块",
        active: editor.isActive("codeBlock"),
        onClick: () => editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        key: "undo",
        title: "撤销",
        active: false,
        onClick: () => {
          if (canUndo) {
            editor.chain().focus().undo().run()
          }
        },
      },
      {
        key: "redo",
        title: "重做",
        active: false,
        onClick: () => {
          if (canRedo) {
            editor.chain().focus().redo().run()
          }
        },
      },
    ]
  }, [canRedo, canUndo, editor])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-start p-4 md:p-8">
      <Card className="w-full">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle>LiteMark</CardTitle>
              <CardDescription>
                编辑区即预览区，输入 Markdown 语法后会实时呈现样式
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{stats.wordCount} words</Badge>
              <Badge variant="outline">{stats.charCount} chars</Badge>
              <Badge variant="secondary">保存: {formatSavedAt(meta.savedAt)}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload />
              导入
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download />
              导出
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
            {toolbar.map((action) => {
              const Icon = ICONS[action.key as keyof typeof ICONS]
              const disabled =
                !editor ||
                (action.key === "undo" && !canUndo) ||
                (action.key === "redo" && !canRedo)

              return (
                <Button
                  key={action.key}
                  variant={action.active ? "secondary" : "outline"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={disabled}
                >
                  <Icon />
                  {action.title}
                </Button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="md-wrap">
            <EditorContent editor={editor} />
          </div>
          <p className="text-muted-foreground text-xs">
            {note || "支持输入 #、-、>、``` 等基础语法，输入后立即生效"}
          </p>
        </CardContent>
      </Card>
      <input
        ref={fileRef}
        type="file"
        accept=".md,text/markdown,text/plain"
        className="hidden"
        onChange={onImport}
      />
    </main>
  )
}

export default App
