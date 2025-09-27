import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkEmoji from "remark-emoji";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import styles from "./Preview.module.css";

import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

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

    return (
      <div ref={ref} className={styles.preview}>
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
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const isInline = !node?.properties?.className;
              return !isInline && match ? (
                <pre className={styles.codeBlock}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
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
