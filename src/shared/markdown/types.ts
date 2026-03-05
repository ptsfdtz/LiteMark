export type MarkdownPluginList = unknown[];

export interface MarkdownPluginToggles {
  gfm: boolean;
  math: boolean;
  emoji: boolean;
  highlight: boolean;
  katex: boolean;
  toc: boolean;
}

export interface MarkdownSecurityOptions {
  allowRawHtml: boolean;
  allowedLinkProtocols: string[];
  allowedImageProtocols: string[];
}

export interface MarkdownPipelineOptions {
  plugins?: Partial<MarkdownPluginToggles>;
  security?: Partial<MarkdownSecurityOptions>;
  extraRemarkPlugins?: MarkdownPluginList;
  extraRehypePlugins?: MarkdownPluginList;
}

export interface MarkdownPipeline {
  remarkPlugins: MarkdownPluginList;
  rehypePlugins: MarkdownPluginList;
  security: MarkdownSecurityOptions;
}
