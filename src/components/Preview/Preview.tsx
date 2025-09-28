import React, { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkEmoji from "remark-emoji";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import "./Preview.css";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";

interface PreviewProps {
  content: string;
}

const processSpecialEmojis = (content: string): string => {
  return content
    .replace(/:fa-([\w-]+):/g, '<i class="fa fa-$1" aria-hidden="true"></i>')
    .replace(
      /:editormd-logo(-\dx)?:/g,
      '<i class="editormd-logo$1" aria-hidden="true"></i>'
    );
};

const Preview = React.forwardRef<HTMLDivElement, PreviewProps>(
  ({ content }, ref) => {
    const processedContent = processSpecialEmojis(content);
    useEffect(() => {
      (window as any).hljs = hljs;
      const highlightCode = () => {
        document
          .querySelectorAll("pre code:not([data-highlighted])")
          .forEach((block) => {
            try {
              hljs.highlightElement(block as HTMLElement);
            } catch (e) {
              console.warn("Highlight error:", e);
            }
          });
      };
      highlightCode();
      const timers = [
        setTimeout(highlightCode, 10),
        setTimeout(highlightCode, 100),
        setTimeout(highlightCode, 500),
      ];
      return () => {
        timers.forEach((timer) => clearTimeout(timer));
      };
    }, [content]);

    return (
      <div ref={ref} className="preview-container">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath, remarkEmoji]}
          rehypePlugins={[
            rehypeHighlight,
            rehypeRaw,
            rehypeKatex,
            rehypeSanitize,
          ]}
          components={{
            img: ({ node, ...props }) => (
              <img
                {...props}
                style={{ maxWidth: "100%", height: "auto" }}
                alt={props.alt || "图片"}
              />
            ),
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    );
  }
);

Preview.displayName = "Preview";

export default Preview;
