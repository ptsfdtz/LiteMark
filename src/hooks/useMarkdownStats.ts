import { useMemo } from "react"

import type { MdStats } from "@/types/markdown-editor"

export function useMarkdownStats(content: string): MdStats {
  return useMemo(() => {
    const text = content.trim()
    const wordCount = text ? text.split(/\s+/).length : 0
    const charCount = content.length

    return {
      wordCount,
      charCount,
    }
  }, [content])
}
