export interface MdStats {
  wordCount: number
  charCount: number
}

export interface MdToolbarAction {
  key: string
  title: string
  active: boolean
  onClick: () => void
}

export interface MdDoc {
  id: string
  title: string
  content: string
  updatedAt: string
}
