import type { Heading, Root } from 'mdast';
import type { VFile } from 'vfile';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import { FrontmatterError, parseYamlFrontmatter, type Frontmatter } from '../frontmatter.js';
import { addWarning } from '../warnings.js';

export type UrlKind = 'link' | 'image';

/**
 * Đổi đường dẫn tương đối (`./02-provider.md`, `./assets/a.webp`) sang URL thật.
 * Trả về chuỗi = URL mới, `null` = không tìm thấy (sinh cảnh báo), `undefined` = giữ nguyên.
 */
export type UrlResolver = (url: string, kind: UrlKind) => string | null | undefined;

export interface ContentInfo {
  frontmatter: Frontmatter;
  title: string | null;
  description: string | null;
  wordCount: number;
}

declare module 'vfile' {
  interface DataMap {
    resolveUrl: UrlResolver | undefined;
    content: ContentInfo;
  }
}

const ABSOLUTE_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i;

/**
 * Một lượt duyệt mdast để: đọc frontmatter, lấy tiêu đề/mô tả/số từ,
 * đổi URL tương đối và lint (ảnh thiếu alt, heading nhảy cấp, link hỏng).
 */
export function remarkContent() {
  return (tree: Root, file: VFile) => {
    let frontmatter: Frontmatter = {};
    const yamlNode = tree.children.find((node) => node.type === 'yaml');
    if (yamlNode) {
      frontmatter = parseYamlFrontmatter(
        yamlNode.value,
        (yamlNode.position?.start.line ?? 1) + 1,
      );
    }

    let firstH1: string | null = null;
    let firstParagraph: string | null = null;
    let previousDepth = 1;
    let wordCount = 0;
    const resolveUrl = file.data.resolveUrl;

    visit(tree, (node) => {
      switch (node.type) {
        case 'heading': {
          const heading = node as Heading;
          if (heading.depth === 1 && firstH1 === null) firstH1 = toString(heading);
          if (heading.depth > previousDepth + 1) {
            addWarning(
              file,
              heading,
              'heading-increment',
              `Heading nhảy từ h${previousDepth} xuống h${heading.depth}`,
            );
          }
          previousDepth = heading.depth;
          break;
        }
        case 'paragraph':
          if (firstParagraph === null) {
            const text = toString(node).trim();
            if (text) firstParagraph = text;
          }
          break;
        case 'text':
        case 'inlineCode':
          wordCount += countWords(node.value);
          break;
        case 'code':
          wordCount += countWords(node.value);
          break;
        case 'image':
          if (!node.alt?.trim()) {
            addWarning(file, node, 'image-alt', `Ảnh "${node.url}" thiếu mô tả (alt)`);
          }
          node.url = resolve(node.url, 'image', node);
          break;
        case 'link':
        case 'definition':
          node.url = resolve(node.url, 'link', node);
          break;
      }
    });

    function resolve(url: string, kind: UrlKind, node: Parameters<typeof addWarning>[1]) {
      if (!resolveUrl || ABSOLUTE_URL_RE.test(url)) return url;
      const resolved = resolveUrl(url, kind);
      if (resolved === undefined) return url;
      if (resolved === null) {
        addWarning(
          file,
          node,
          'broken-link',
          kind === 'image' ? `Không tìm thấy ảnh "${url}"` : `Link nội bộ "${url}" không trỏ tới bài nào`,
        );
        return url;
      }
      return resolved;
    }

    file.data.content = {
      frontmatter,
      title: frontmatter.title ?? firstH1,
      description: frontmatter.description ?? truncate(firstParagraph, 160),
      wordCount,
    };
  };
}

/** Code fence: chuyển meta (`title="a.ts" {1,3} showLineNumbers`) sang thuộc tính để qua được rehype. */
export function remarkCodeMeta() {
  return (tree: Root) => {
    visit(tree, 'code', (node) => {
      if (!node.meta) return;
      node.data = {
        ...node.data,
        hProperties: { ...node.data?.hProperties, metastring: node.meta },
      };
    });
  };
}

function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}

function truncate(text: string | null, max: number): string | null {
  if (text === null || text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export { FrontmatterError };
