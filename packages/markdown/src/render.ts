import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import {
  transformerMetaHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
} from '@shikijs/transformers';
import rehypeAutolinkHeadings, {
  type Options as AutolinkOptions,
} from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { createHighlighter, type HighlighterGeneric, type ShikiTransformer } from 'shiki';
import { unified, type Processor } from 'unified';
import { VFile } from 'vfile';
import type { Frontmatter } from './frontmatter.js';
import { remarkDirectives } from './plugins/remark-directives.js';
import { remarkCodeMeta, remarkContent, type UrlResolver } from './plugins/remark-content.js';
import {
  rehypeCodeBlocks,
  rehypeEmbedsAndLinks,
  rehypeToc,
  type TocItem,
} from './plugins/rehype-content.js';
import { sanitizeSchema } from './sanitize-schema.js';
import type { RenderWarning } from './warnings.js';

export interface RenderOptions {
  resolveUrl?: UrlResolver;
}

export interface RenderResult {
  html: string;
  toc: TocItem[];
  frontmatter: Frontmatter;
  /** frontmatter.title, nếu không có thì lấy h1 đầu tiên. */
  title: string | null;
  description: string | null;
  wordCount: number;
  /** Phút, làm tròn lên, tối thiểu 1. frontmatter.reading_time được ưu tiên. */
  readingTime: number;
  warnings: RenderWarning[];
}

/** Ngôn ngữ nạp sẵn cho code block; ngôn ngữ khác hiển thị dạng text thường. */
export const CODE_LANGUAGES = [
  'typescript', 'javascript', 'tsx', 'jsx', 'json', 'jsonc', 'bash', 'shellscript',
  'yaml', 'html', 'css', 'scss', 'sql', 'python', 'java', 'go', 'rust', 'php',
  'csharp', 'c', 'cpp', 'kotlin', 'swift', 'diff', 'markdown', 'dockerfile',
  'prisma', 'graphql', 'xml', 'ini', 'toml', 'nginx', 'http',
] as const;

const WORDS_PER_MINUTE = 200;

let processorPromise: Promise<Processor<any, any, any, any, string>> | undefined;

/** Markdown -> HTML an toàn + mục lục + frontmatter + cảnh báo lint. */
export async function renderMarkdown(
  source: string,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const processor = await getProcessor();
  const file = new VFile({ value: source, data: { resolveUrl: options.resolveUrl } });
  const html = String(await processor.process(file));
  const content = file.data.content!;
  const readingTime =
    content.frontmatter.reading_time ??
    Math.max(1, Math.ceil(content.wordCount / WORDS_PER_MINUTE));

  return {
    html,
    toc: file.data.toc ?? [],
    frontmatter: content.frontmatter,
    title: content.title,
    description: content.description,
    wordCount: content.wordCount,
    readingTime,
    warnings: file.data.warnings ?? [],
  };
}

/** Khởi tạo trước Shiki (tốn vài trăm ms) để request đầu tiên không bị chậm. */
export async function warmUpMarkdown(): Promise<void> {
  await getProcessor();
}

function getProcessor() {
  processorPromise ??= createProcessor().catch((error: unknown) => {
    processorPromise = undefined;
    throw error;
  });
  return processorPromise;
}

async function createProcessor() {
  const highlighter = await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [...CODE_LANGUAGES],
  });

  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkDirectives)
    .use(remarkContent)
    .use(remarkCodeMeta)
    // Không bật allowDangerousHtml: HTML thô trong Markdown bị bỏ.
    .use(remarkRehype, { footnoteLabel: 'Chú thích', footnoteBackLabel: 'Quay lại nội dung' })
    .use(rehypeSanitize, sanitizeSchema)
    // Từ đây trở xuống chỉ chạy plugin tin cậy trên cây đã sanitize.
    .use(rehypeKatex, { strict: 'ignore' })
    .use(rehypeCodeBlocks)
    .use(() =>
      rehypeShikiFromHighlighter(highlighter as HighlighterGeneric<any, any>, {
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
        defaultLanguage: 'text',
        fallbackLanguage: 'text',
        transformers: [
          transformerMetaHighlight(),
          // Chú thích kiểu Mintlify/Shiki trong code: // [!code ++], [!code --], [!code highlight],
          // [!code focus], [!code error], [!code warning]. Chú thích bị xoá khỏi code hiển thị.
          transformerNotationDiff({ matchAlgorithm: 'v3' }),
          transformerNotationHighlight({ matchAlgorithm: 'v3' }),
          transformerNotationFocus({ matchAlgorithm: 'v3' }),
          transformerNotationErrorLevel({ matchAlgorithm: 'v3' }),
          codeMetaFlagsTransformer,
        ],
      }),
    )
    .use(rehypeSlug)
    .use(rehypeToc)
    .use(rehypeAutolinkHeadings, autolinkOptions)
    .use(rehypeEmbedsAndLinks)
    .use(rehypeStringify)
    .freeze();
}

const autolinkOptions: AutolinkOptions = {
  behavior: 'append',
  properties: { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 },
  content: { type: 'text', value: '#' },
};

/** Cờ trong meta của code fence: `showLineNumbers` (hoặc `lines` như Mintlify) đánh số dòng, `wrap` xuống dòng. */
const codeMetaFlagsTransformer: ShikiTransformer = {
  name: 'docshub:code-meta-flags',
  pre(node) {
    const meta = this.options.meta?.__raw ?? '';
    if (/(?:^|\s)(?:showLineNumbers|lines)(?:\s|$)/.test(meta)) this.addClassToHast(node, 'line-numbers');
    if (/(?:^|\s)wrap(?:\s|$)/.test(meta)) this.addClassToHast(node, 'wrap');
  },
};
