import type { Element, ElementContent, Root } from 'hast';
import type { VFile } from 'vfile';
import { h } from 'hastscript';
import { toString } from 'hast-util-to-string';
import { visit, SKIP } from 'unist-util-visit';

export interface TocItem {
  depth: 2 | 3;
  id: string;
  text: string;
}

declare module 'vfile' {
  interface DataMap {
    toc: TocItem[];
  }
}

const TITLE_RE = /title=(?:"([^"]*)"|'([^']*)')/;

/**
 * Chạy sau sanitize, trước Shiki:
 * - ```mermaid -> <pre class="mermaid"> để client tự vẽ, không đưa qua Shiki
 * - ```tree -> cây thư mục (giống <Tree> của Mintlify)
 * - meta `title="..."` -> bọc code block trong khung có tiêu đề
 */
export function rehypeCodeBlocks() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return;
      const code = node.children[0];
      if (!code || code.type !== 'element' || code.tagName !== 'code') return;

      const classes = (code.properties.className as string[] | undefined) ?? [];
      if (classes.includes('language-mermaid')) {
        parent.children[index] = h('pre', { className: ['mermaid'] }, toString(code).trimEnd());
        return SKIP;
      }
      if (classes.includes('language-tree')) {
        parent.children[index] = fileTree(toString(code));
        return SKIP;
      }

      const meta = String(code.properties.metastring ?? '');
      const title = TITLE_RE.exec(meta);
      if (!title) return;
      parent.children[index] = h('div', { className: ['code-block'] }, [
        h('div', { className: ['code-block-title'] }, title[1] ?? title[2]),
        node,
      ]);
      return SKIP;
    });
  };
}

interface TreeEntry {
  name: string;
  comment: string | null;
  depth: number;
  children: TreeEntry[];
}

const TREE_GLYPH_RE = /[├└]/;

/**
 * Dựng cây thư mục từ nội dung ```tree. Nhận hai kiểu viết:
 * thụt lề (2 dấu cách hoặc tab mỗi cấp) hoặc dán nguyên kết quả lệnh `tree` (├── │ └──).
 * Tên kết thúc bằng "/" hoặc có con là thư mục; phần sau " #" là chú thích.
 */
function fileTree(source: string): Element {
  const lines = source.replace(/\t/g, '  ').split('\n').filter((line) => line.trim() !== '');
  const indents = lines
    .filter((line) => !TREE_GLYPH_RE.test(line))
    .map((line) => line.length - line.trimStart().length)
    .filter((n) => n > 0);
  const unit = indents.length ? Math.min(...indents) : 2;

  const root: TreeEntry = { name: '', comment: null, depth: -1, children: [] };
  const stack: TreeEntry[] = [root];
  for (const line of lines) {
    const glyph = line.search(TREE_GLYPH_RE);
    const depth =
      glyph >= 0 ? Math.round(glyph / 4) + 1 : Math.round((line.length - line.trimStart().length) / unit);
    const text = (glyph >= 0 ? line.slice(glyph).replace(/^[├└][─\s]*/, '') : line).trim();
    const hash = text.search(/\s#\s?/);
    const entry: TreeEntry = {
      name: (hash >= 0 ? text.slice(0, hash) : text).trim(),
      comment: hash >= 0 ? text.slice(hash).replace(/^\s#\s?/, '').trim() : null,
      depth,
      children: [],
    };
    while (stack.length > 1 && stack.at(-1)!.depth >= depth) stack.pop();
    stack.at(-1)!.children.push(entry);
    stack.push(entry);
  }

  const item = (entry: TreeEntry): Element => {
    const folder = entry.name.endsWith('/') || entry.children.length > 0;
    const label = [
      h('span', { className: ['icon'], dataIcon: folder ? 'folder' : 'file' }),
      h('span', { className: ['file-tree-name'] }, entry.name.replace(/\/$/, '')),
      ...(entry.comment ? [h('span', { className: ['file-tree-comment'] }, entry.comment)] : []),
    ];
    if (!folder || entry.children.length === 0) return h('li', label);
    return h('li', [
      h('details', { open: true }, [h('summary', label), h('ul', entry.children.map(item))]),
    ]);
  };
  return h('div', { className: ['file-tree'] }, [h('ul', root.children.map(item))]);
}

/** Lấy mục lục h2–h3. Chạy sau rehype-slug (cần id) và trước autolink (tránh dính ký tự "#"). */
export function rehypeToc() {
  return (tree: Root, file: VFile) => {
    const toc: TocItem[] = [];
    visit(tree, 'element', (node) => {
      if ((node.tagName === 'h2' || node.tagName === 'h3') && node.properties.id) {
        toc.push({
          depth: node.tagName === 'h2' ? 2 : 3,
          id: String(node.properties.id),
          text: toString(node).trim(),
        });
      }
    });
    file.data.toc = toc;
  };
}

/**
 * Chạy sau sanitize: dựng iframe YouTube/Vimeo từ placeholder đã kiểm tra ID,
 * mở link ngoài ở tab mới, và cho ảnh tải lười (lazy).
 */
export function rehypeEmbedsAndLinks() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img') {
        node.properties.loading = 'lazy';
        node.properties.decoding = 'async';
        return;
      }
      if (node.tagName === 'a') {
        const href = String(node.properties.href ?? '');
        if (/^https?:\/\//i.test(href)) {
          node.properties.target = '_blank';
          node.properties.rel = ['noopener', 'noreferrer'];
        }
        return;
      }

      const classes = (node.properties.className as string[] | undefined) ?? [];
      if (node.tagName !== 'div' || !classes.includes('embed')) return;
      const id = String(node.properties.dataEmbedId ?? '');
      const src = classes.includes('embed-youtube')
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : `https://player.vimeo.com/video/${id}`;
      delete node.properties.dataEmbedId;
      node.children = [
        h('iframe', {
          src,
          title: classes.includes('embed-youtube') ? 'Video YouTube' : 'Video Vimeo',
          loading: 'lazy',
          allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
          allowFullScreen: true,
          referrerPolicy: 'strict-origin-when-cross-origin',
        }) as ElementContent,
      ];
    });
  };
}
