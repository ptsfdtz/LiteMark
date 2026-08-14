# LiteMark Markdown Full Test

Use this document to verify editing, saving, Markdown serialization, and preview rendering.

---

## 1. Paragraphs and Inline Formatting

This is a normal paragraph. Press Enter here and confirm the next line remains a normal paragraph.

**Bold text**, *italic text*, ***bold italic text***, ~~strikethrough text~~, and `inline code`.

Escaped characters: \*not italic\*, #not a heading, \[not a link\].

Unicode: Chinese, English, 123, punctuation, and emoji 😀 🚀 ✅.

## 2. Headings

### Heading Level 3

#### Heading Level 4

##### Heading Level 5

###### Heading Level 6

## 3. Links and Images

[LiteMark repository](https://github.com/)

[https://example.com](https://example.com)

![LiteMark icon](public/icon.svg)

## 4. Lists

- Unordered item
- Another unordered item
  - Nested item
  - Nested item with **bold text**
- Final item

1. Ordered item
2. Ordered item
  1. Nested ordered item
  2. Another nested ordered item
3. Final ordered item
4. Explicit number four
5. Explicit number six

## 5. Task Lists

- [ ] Write a Markdown document
- [x] Save the document
- [ ] Toggle this task in preview
  - [x] Nested completed task
  - [ ] Nested incomplete task

## 6. Blockquotes

> A blockquote can contain **formatting**, `inline code`, and a [link](https://example.com).
>
> > Nested blockquotes should retain their structure.

## 7. Tables


| Feature | Markdown input | Expected result      |
| :------- | :-------------- | :-------------------- |
| Bold    | `**text**`     | Bold text            |
| Code    | ``code``       | Inline code          |
| Task    | `- [ ]`        | Interactive checkbox |
| Math    | `$x^2$`        | Rendered equation    |


## 8. Code Blocks

### Python

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("LiteMark"))
```

### TypeScript

```typescript
interface DocumentSession {
  path: string;
  dirty: boolean;
}

const session: DocumentSession = { path: 'test.md', dirty: true };
console.log(session);
```

### JSON

```json
{
  "name": "LiteMark",
  "features": ["Markdown", "Preview", "Syntax highlighting"],
  "ready": true
}
```

### Bash

```bash
pnpm test
pnpm build
```

## 9. Math

Inline math: $E = mc^2$ and $\int_0^1 x^2\,dx = \frac{1}{3}$.

Display math:

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

## 10. Horizontal Rule

The next line is a horizontal rule.

---

## 11. Emoji and Special Characters

:smile: :rocket: :white\_check\_mark: :warning:

Copyright © 2026. Quotes: "double" and 'single'.

## 12. Safe HTML Preview

Open this details block in preview

Safe HTML should remain visible in the preview.

## 13. Long Text and Soft Breaks

This paragraph is intentionally long enough to check line wrapping in a narrow editor pane. It should wrap visually without changing the saved Markdown content, and it should remain readable in both light and dark themes.

This line ends with two spaces.  
This line should render after a Markdown hard line break.

## 14. Final Editing Check

Place the caret at the end of this heading, press Enter, and type a sentence below. The new block must be a normal paragraph, not another heading.

Save this file, close it, reopen it, and confirm all content and formatting remain intact.