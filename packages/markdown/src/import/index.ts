import { convertImportedDoc, type ImportWarning } from './convert.js';
import {
  findAsset,
  findLinkTarget,
  readImported,
  type ImportDoc,
  type ImportNode,
  type ImportProject,
} from './project.js';

export { convertImportedDoc, type ConvertOptions, type ConvertResult, type ImportFlavor, type ImportWarning } from './convert.js';
export {
  analyzeImport,
  findAsset,
  findLinkTarget,
  MAX_IMPORT_DEPTH,
  type ImportCategory,
  type ImportDoc,
  type ImportFile,
  type ImportFormat,
  type ImportNode,
  type ImportProject,
} from './project.js';

export interface ConvertedDoc {
  key: string;
  /** Đường dẫn trong cây DocsHub sau khi nhập (`nhom/bai`). */
  path: string;
  title: string;
  markdown: string;
  warnings: ImportWarning[];
  /** File ảnh trong gói mà bài dùng. */
  images: string[];
}

export interface ConvertProjectOptions {
  /** Slug các nhóm bao ngoài (khi nhập vào một nhóm mới). */
  basePath?: string[];
  /** URL thay cho file ảnh trong gói (ví dụ placeholder, rồi đổi thành URL asset sau khi tải lên). */
  assetUrl: (zipPath: string) => string;
}

/** Chuyển mọi bài của dự án, link giữa các bài trỏ tới đường dẫn mới trong DocsHub. */
export function convertProject(project: ImportProject, options: ConvertProjectOptions): ConvertedDoc[] {
  const paths = new Map<string, string>();
  const docs: { doc: ImportDoc; path: string }[] = [];
  const walk = (nodes: ImportNode[], prefix: string[]) => {
    for (const node of nodes) {
      if (node.kind === 'category') walk(node.children, [...prefix, node.slug]);
      else {
        const path = [...prefix, node.slug].join('/');
        paths.set(node.key, path);
        docs.push({ doc: node, path });
      }
    }
  };
  walk(project.nodes, options.basePath ?? []);

  return docs.map(({ doc, path }) => {
    const images = new Set<string>();
    const missing = new Set<string>();
    const result = convertImportedDoc(project.files.get(doc.key)?.text ?? '', {
      flavor: project.flavor,
      path: doc.key,
      fallbackTitle: doc.title,
      resolveLink: (url, from) => {
        const target = findLinkTarget(project, from, url);
        if (!target) return undefined;
        const targetPath = paths.get(target);
        if (!targetPath) return undefined;
        const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
        // Link tương đối kiểu Docusaurus: DocsHub đổi sang URL trang đọc lúc render.
        return `./${targetPath}.md${hash}`;
      },
      resolveImage: (url, from) => {
        const asset = findAsset(project, from, url);
        if (!asset) {
          if (!/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) missing.add(url);
          return undefined;
        }
        images.add(asset);
        return options.assetUrl(asset);
      },
      readFile: (source, from) => readImported(project, from, source),
    });
    const warnings = [
      ...result.warnings,
      ...[...missing].map((url) => ({ message: `Không tìm thấy ảnh "${url}" trong gói nhập`, line: null })),
    ];
    return { key: doc.key, path, title: result.title, markdown: result.markdown, warnings, images: [...images] };
  });
}
