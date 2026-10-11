import { slugify, stripNumberPrefix, type UrlResolver } from '@docshub/markdown';
import type { DocNode } from './tree.js';

const DOC_EXTENSION_RE = /\.mdx?$/i;
const OTHER_EXTENSION_RE = /\.[a-z0-9]{1,5}$/i;

/**
 * Đổi link tương đối kiểu Docusaurus sang URL trang đọc:
 * `./02-provider.md#scope` -> `/courses/nestjs/2026/kien-truc/provider#scope`.
 * Khớp theo slug của file (bỏ tiền tố số và đuôi .md); trùng slug thì ưu tiên bài
 * có thư mục cha khớp với đường dẫn. Ảnh và file khác giữ nguyên.
 */
export function createLinkResolver(docs: DocNode[], basePath: string): UrlResolver {
  const bySlug = new Map<string, DocNode[]>();
  for (const doc of docs) {
    const list = bySlug.get(doc.slug);
    if (list) list.push(doc);
    else bySlug.set(doc.slug, [doc]);
  }

  return (url, kind) => {
    if (kind === 'image') return undefined;
    const hashIndex = url.indexOf('#');
    const pathPart = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
    if (!pathPart) return undefined;
    if (!DOC_EXTENSION_RE.test(pathPart) && OTHER_EXTENSION_RE.test(pathPart)) {
      return undefined;
    }

    const segments = pathPart
      .split('/')
      .filter((s) => s && s !== '.' && s !== '..')
      .map((s) => slugify(stripNumberPrefix(s.replace(DOC_EXTENSION_RE, '')).name));
    const slug = segments.at(-1);
    if (!slug) return undefined;

    const candidates = bySlug.get(slug);
    if (!candidates) return null;
    const folders = segments.slice(0, -1).join('/');
    const match =
      (folders && candidates.find((d) => d.path.endsWith(`${folders}/${slug}`))) ||
      candidates[0];
    return `${basePath}/${match.path}${hash}`;
  };
}
