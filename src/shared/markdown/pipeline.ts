import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkEmoji from 'remark-emoji';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type {
  MarkdownPipeline,
  MarkdownPipelineOptions,
  MarkdownPluginList,
  MarkdownPluginToggles,
} from './types';
import { DEFAULT_ALLOWED_IMAGE_PROTOCOLS, DEFAULT_ALLOWED_LINK_PROTOCOLS } from './security';

const DEFAULT_PLUGIN_TOGGLES: MarkdownPluginToggles = {
  gfm: true,
  math: true,
  emoji: true,
  highlight: true,
  katex: true,
  toc: false,
};

const SANITIZE_CLASS_NAMES = ['className'];

const buildSanitizeSchema = () => {
  const schema = {
    ...defaultSchema,
    attributes: {
      ...(defaultSchema.attributes ?? {}),
      a: [...((defaultSchema.attributes?.a as unknown[]) ?? []), 'target', 'rel'],
      code: [...((defaultSchema.attributes?.code as unknown[]) ?? []), ...SANITIZE_CLASS_NAMES],
      div: [...((defaultSchema.attributes?.div as unknown[]) ?? []), ...SANITIZE_CLASS_NAMES],
      span: [...((defaultSchema.attributes?.span as unknown[]) ?? []), ...SANITIZE_CLASS_NAMES],
      img: [...((defaultSchema.attributes?.img as unknown[]) ?? []), 'src', 'alt', 'title'],
    },
  };
  return schema;
};

export function createMarkdownPipeline(options: MarkdownPipelineOptions = {}): MarkdownPipeline {
  const plugins: MarkdownPluginToggles = {
    ...DEFAULT_PLUGIN_TOGGLES,
    ...(options.plugins ?? {}),
  };
  const security = {
    allowRawHtml: false,
    allowedLinkProtocols: DEFAULT_ALLOWED_LINK_PROTOCOLS,
    allowedImageProtocols: DEFAULT_ALLOWED_IMAGE_PROTOCOLS,
    ...(options.security ?? {}),
  };

  const remarkPlugins: MarkdownPluginList = [];
  if (plugins.gfm) remarkPlugins.push(remarkGfm);
  if (plugins.math) remarkPlugins.push(remarkMath);
  if (plugins.emoji) remarkPlugins.push(remarkEmoji);

  const rehypePlugins: MarkdownPluginList = [];
  if (security.allowRawHtml) {
    rehypePlugins.push(rehypeRaw);
  }
  rehypePlugins.push([rehypeSanitize, buildSanitizeSchema()]);
  if (plugins.highlight) {
    rehypePlugins.push(rehypeHighlight);
  }
  if (plugins.math && plugins.katex) {
    rehypePlugins.push(rehypeKatex);
  }

  if (options.extraRemarkPlugins?.length) {
    remarkPlugins.push(...options.extraRemarkPlugins);
  }
  if (options.extraRehypePlugins?.length) {
    rehypePlugins.push(...options.extraRehypePlugins);
  }

  return {
    remarkPlugins,
    rehypePlugins,
    security,
  };
}
