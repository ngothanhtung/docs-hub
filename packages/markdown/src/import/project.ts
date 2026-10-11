import { parse as parseYaml } from 'yaml';
import { slugify, stripNumberPrefix } from '../slugify.js';
import type { ImportFlavor, ImportWarning } from './convert.js';

/** Một file trong gói nhập. `text` chỉ có với file chữ (.md, .mdx, .json, .yml). */
export interface ImportFile {
  path: string;
  size: number;
  text?: string;
}

export type ImportFormat = 'auto' | ImportFlavor;

export interface ImportCategory {
  kind: 'category';
  key: string;
  label: string;
  slug: string;
  icon: string | null;
  collapsed: boolean;
  description: string | null;
  children: ImportNode[];
}

export interface ImportDoc {
  kind: 'doc';
  /** Đường dẫn file trong gói = khoá định danh bài. */
  key: string;
  slug: string;
  /** Tiêu đề dự kiến (frontmatter title/sidebar_label, tên file); bản chuyển đổi có thể cho tiêu đề chính xác hơn. */
  title: string;
}

export type ImportNode = ImportCategory | ImportDoc;

export interface ImportProject {
  flavor: ImportFlavor;
  /** Thư mục gốc của dự án trong gói ("" = gốc gói). */
  root: string;
  nodes: ImportNode[];
  /** File không nhập, kèm lý do. */
  skipped: { path: string; reason: string }[];
  warnings: ImportWarning[];
  files: Map<string, ImportFile>;
  /** Thư mục chứa ảnh tĩnh: `static/` của Docusaurus, gốc dự án với Mintlify. */
  staticRoots: string[];
  /** Route/đường dẫn trang -> khoá bài, để đổi link tuyệt đối (`/docs/intro`, `/quickstart`). */
  routes: Map<string, string>;
}

/** Số cấp nhóm bài tối đa của DocsHub. */
export const MAX_IMPORT_DEPTH = 3;

const DOC_RE = /\.mdx?$/i;
const IGNORED_DIRS = /(^|\/)(node_modules|\.git|\.docusaurus|build|dist|\.next|__MACOSX)(\/|$)/;

/**
 * Đọc cấu trúc một dự án Docusaurus (thư mục `docs/`, `_category_.json`, `sidebar_position`,
 * tiền tố số) hoặc Mintlify (`docs.json`/`mint.json` navigation) thành cây nhóm/bài.
 * Không đọc `sidebars.js`/`docusaurus.config.js` vì đó là code JavaScript.
 */
export function analyzeImport(input: ImportFile[], format: ImportFormat = 'auto'): ImportProject {
  const files = new Map(
    input
      .filter((f) => !IGNORED_DIRS.test(f.path) && !/(^|\/)\.[^/]+$/.test(f.path))
      .map((f) => [f.path, f]),
  );
  const paths = [...files.keys()];
  const marker = (re: RegExp) =>
    paths.filter((p) => re.test(p)).sort((a, b) => a.split('/').length - b.split('/').length)[0];

  const mintConfig = marker(/(^|\/)(docs|mint)\.json$/);
  const docusaurusConfig = marker(/(^|\/)(docusaurus\.config\.(js|ts|mjs|cjs)|sidebars\.(js|ts))$/);
  const flavor: ImportFlavor =
    format !== 'auto' ? format : mintConfig && !docusaurusConfig ? 'mintlify' : 'docusaurus';

  const project: ImportProject = {
    flavor,
    root: '',
    nodes: [],
    skipped: [],
    warnings: [],
    files,
    staticRoots: [],
    routes: new Map(),
  };

  if (flavor === 'mintlify' && mintConfig) {
    project.root = dirname(mintConfig);
    buildMintlify(project, mintConfig);
  } else {
    if (flavor === 'mintlify') {
      project.warnings.push({ message: 'Không thấy docs.json/mint.json: sắp xếp theo thư mục', line: null });
    }
    project.root = docusaurusConfig ? dirname(docusaurusConfig) : commonRoot(paths.filter((p) => DOC_RE.test(p)));
    buildFolders(project);
  }
  return project;
}

// ---------- Docusaurus (và thư mục Markdown thường) ----------

function buildFolders(project: ImportProject) {
  const root = project.root;
  const docsDir = [...project.files.keys()].some((p) => p.startsWith(join(root, 'docs/')))
    ? join(root, 'docs')
    : root;
  project.staticRoots = [join(root, 'static'), root];

  interface Folder {
    path: string;
    folders: Map<string, Folder>;
    docs: string[];
  }
  const tree: Folder = { path: docsDir, folders: new Map(), docs: [] };

  for (const path of project.files.keys()) {
    if (!DOC_RE.test(path) || !isInside(path, docsDir)) continue;
    const rel = relative(docsDir, path);
    const parts = rel.split('/');
    // File/thư mục bắt đầu bằng "_" là partial (được import vào bài khác), không phải trang.
    if (parts.some((p) => p.startsWith('_'))) {
      project.skipped.push({ path, reason: 'Partial (tên bắt đầu bằng "_"), chỉ nhúng vào bài khác' });
      continue;
    }
    let folder = tree;
    for (const part of parts.slice(0, -1)) {
      const next: Folder = folder.folders.get(part) ?? { path: join(folder.path, part), folders: new Map(), docs: [] };
      folder.folders.set(part, next);
      folder = next;
    }
    folder.docs.push(path);
  }
  for (const path of project.files.keys()) {
    if (DOC_RE.test(path) && !isInside(path, docsDir)) {
      project.skipped.push({ path, reason: 'Nằm ngoài thư mục docs/' });
    }
  }

  const build = (folder: Folder, depth: number): ImportNode[] => {
    const items: { order: number; name: string; node: ImportNode; index: boolean }[] = [];
    for (const [name, sub] of folder.folders) {
      const meta = categoryMeta(project, sub.path);
      const parsed = stripNumberPrefix(name);
      const children = build(sub, depth + 1);
      if (children.length === 0) continue;
      const label = meta.label ?? humanize(parsed.name);
      if (depth >= MAX_IMPORT_DEPTH) {
        project.warnings.push({
          message: `Thư mục "${relative(project.root, sub.path)}" lồng quá ${MAX_IMPORT_DEPTH} cấp: bài bên trong được đưa lên nhóm cha`,
          line: null,
        });
        for (const child of children) items.push({ order: meta.position ?? parsed.position ?? Infinity, name, node: child, index: false });
        continue;
      }
      items.push({
        order: meta.position ?? parsed.position ?? Infinity,
        name,
        index: false,
        node: {
          kind: 'category',
          key: sub.path,
          label,
          slug: slugify(parsed.name) || 'nhom',
          icon: meta.icon,
          collapsed: meta.collapsed,
          description: meta.description,
          children,
        },
      });
    }
    for (const path of folder.docs) {
      const file = basename(path).replace(DOC_RE, '');
      const parsed = stripNumberPrefix(file);
      const fm = readFrontmatter(project.files.get(path)?.text ?? '');
      const folderName = basename(folder.path);
      const isIndex = /^(index|readme)$/i.test(parsed.name) || (folder !== tree && parsed.name === stripNumberPrefix(folderName).name);
      const title = fm.sidebar_label ?? fm.title ?? humanize(parsed.name);
      const position = typeof fm.sidebar_position === 'number' ? fm.sidebar_position : parsed.position;
      items.push({
        order: isIndex ? -Infinity : position ?? Infinity,
        name: file,
        index: isIndex,
        node: {
          kind: 'doc',
          key: path,
          slug: (isIndex ? slugify(fm.title ?? '') || 'tong-quan' : slugify(parsed.name)) || 'bai',
          title,
        },
      });
      // Route Docusaurus: /docs/<id> với id = đường dẫn bỏ đuôi và tiền số; bài index = route của thư mục.
      const id = relative(docsDir, path)
        .replace(DOC_RE, '')
        .split('/')
        .map((s) => stripNumberPrefix(s).name)
        .join('/');
      project.routes.set(id, path);
      if (isIndex) project.routes.set(id.split('/').slice(0, -1).join('/'), path);
      if (typeof fm.slug === 'string') project.routes.set(fm.slug.replace(/^\/+|\/+$/g, ''), path);
      if (typeof fm.id === 'string') project.routes.set([...id.split('/').slice(0, -1), fm.id].join('/'), path);
    }
    items.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'vi', { numeric: true }));
    return uniqueSlugs(items.map((i) => i.node));
  };

  project.nodes = build(tree, 1);
}

interface CategoryMeta {
  label?: string;
  position?: number;
  collapsed: boolean;
  description: string | null;
  icon: string | null;
}

function categoryMeta(project: ImportProject, folder: string): CategoryMeta {
  const file =
    project.files.get(join(folder, '_category_.json')) ??
    project.files.get(join(folder, '_category_.yml')) ??
    project.files.get(join(folder, '_category_.yaml'));
  const empty: CategoryMeta = { collapsed: false, description: null, icon: null };
  if (!file?.text) return empty;
  let data: Record<string, unknown>;
  try {
    data = (file.path.endsWith('.json') ? JSON.parse(file.text) : parseYaml(file.text)) as Record<string, unknown>;
  } catch {
    project.warnings.push({ message: `${file.path} lỗi cú pháp, đã bỏ qua`, line: null });
    return empty;
  }
  const link = data.link as { description?: unknown } | undefined;
  return {
    label: typeof data.label === 'string' ? data.label : undefined,
    position: typeof data.position === 'number' ? data.position : undefined,
    collapsed: data.collapsed === true,
    description: typeof link?.description === 'string' ? link.description : null,
    icon: typeof data.icon === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(data.icon) ? data.icon : null,
  };
}

// ---------- Mintlify ----------

interface NavGroup {
  label: string;
  icon: string | null;
  items: (NavGroup | string)[];
}

function buildMintlify(project: ImportProject, configPath: string) {
  project.staticRoots = [project.root];
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(project.files.get(configPath)?.text ?? '{}') as Record<string, unknown>;
  } catch {
    project.warnings.push({ message: `${configPath} lỗi cú pháp JSON: sắp xếp theo thư mục`, line: null });
    buildFolders(project);
    return;
  }

  let groups = readNavigation(config.navigation, project);
  // Chỉ có một tab bọc ngoài các nhóm: bỏ cấp tab để không phí một cấp lồng.
  if (groups.length === 1 && typeof groups[0] !== 'string' && groups[0].items.every((i) => typeof i !== 'string')) {
    groups = groups[0].items;
  }
  const used = new Set<string>();

  const toNodes = (items: (NavGroup | string)[], depth: number, parentKey: string): ImportNode[] => {
    const nodes: ImportNode[] = [];
    for (const item of items) {
      if (typeof item === 'string') {
        const doc = mintlifyPage(project, item);
        if (doc) {
          used.add(doc.key);
          nodes.push(doc);
        }
        continue;
      }
      const key = `${parentKey}/${item.label}`;
      const children = toNodes(item.items, depth + 1, key);
      if (children.length === 0) continue;
      if (depth >= MAX_IMPORT_DEPTH) {
        project.warnings.push({
          message: `Nhóm "${item.label}" lồng quá ${MAX_IMPORT_DEPTH} cấp: trang bên trong được đưa lên nhóm cha`,
          line: null,
        });
        nodes.push(...children);
        continue;
      }
      nodes.push({
        kind: 'category',
        key,
        label: item.label,
        slug: slugify(item.label) || 'nhom',
        icon: item.icon,
        collapsed: false,
        description: null,
        children,
      });
    }
    return uniqueSlugs(nodes);
  };
  project.nodes = toNodes(groups, 1, 'nav');

  for (const path of project.files.keys()) {
    if (!DOC_RE.test(path) || used.has(path) || !isInside(path, project.root)) continue;
    const rel = relative(project.root, path);
    if (rel.startsWith('snippets/') || basename(rel).startsWith('_')) continue;
    project.skipped.push({ path, reason: 'Không có trong navigation của docs.json/mint.json' });
  }
}

/** docs.json mới (tabs/anchors/groups/pages, có thể lồng) và mint.json cũ (mảng group). */
function readNavigation(nav: unknown, project: ImportProject): (NavGroup | string)[] {
  if (Array.isArray(nav)) return nav.flatMap((item) => readNavItem(item, project));
  if (!nav || typeof nav !== 'object') return [];
  const node = nav as Record<string, unknown>;
  for (const multi of ['versions', 'languages'] as const) {
    if (Array.isArray(node[multi]) && node[multi].length) {
      const first = node[multi][0] as Record<string, unknown>;
      if (node[multi].length > 1) {
        project.warnings.push({
          message: `docs.json có nhiều ${multi === 'versions' ? 'phiên bản' : 'ngôn ngữ'}: chỉ nhập "${String(first.version ?? first.language ?? 'đầu tiên')}"`,
          line: null,
        });
      }
      return readNavigation(first, project);
    }
  }
  return readNavItem(node, project);
}

function readNavItem(item: unknown, project: ImportProject): (NavGroup | string)[] {
  if (typeof item === 'string') return [item];
  if (!item || typeof item !== 'object') return [];
  const node = item as Record<string, unknown>;
  const icon = typeof node.icon === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(node.icon) ? node.icon : null;
  const nested = [
    ...(Array.isArray(node.tabs) ? node.tabs : []),
    ...(Array.isArray(node.anchors) ? node.anchors : []),
    ...(Array.isArray(node.dropdowns) ? node.dropdowns : []),
    ...(Array.isArray(node.products) ? node.products : []),
  ];
  const children = [
    ...nested.flatMap((n) => readNavItem(n, project)),
    ...(Array.isArray(node.groups) ? node.groups.flatMap((g) => readNavItem(g, project)) : []),
    ...(Array.isArray(node.pages) ? node.pages.flatMap((p) => readNavItem(p, project)) : []),
  ];
  const label = ['group', 'tab', 'anchor', 'dropdown', 'product']
    .map((k) => node[k])
    .find((v): v is string => typeof v === 'string' && v.trim() !== '');
  if (!label) return children;
  // Tab chỉ có một nhóm cùng tên thì không cần lồng thêm một cấp.
  return [{ label, icon, items: children }];
}

function mintlifyPage(project: ImportProject, ref: string): ImportDoc | null {
  if (/\s/.test(ref.trim()) || /\.(json|ya?ml)\b/.test(ref)) {
    project.skipped.push({ path: ref, reason: 'Trang sinh từ OpenAPI chưa hỗ trợ' });
    return null;
  }
  const clean = ref.replace(/^\/+/, '').replace(DOC_RE, '');
  const path = [`${clean}.mdx`, `${clean}.md`].map((p) => join(project.root, p)).find((p) => project.files.has(p));
  if (!path) {
    project.warnings.push({ message: `navigation trỏ tới "${ref}" nhưng không có file .mdx/.md`, line: null });
    return null;
  }
  const fm = readFrontmatter(project.files.get(path)?.text ?? '');
  project.routes.set(clean, path);
  return {
    kind: 'doc',
    key: path,
    // Trang index lấy slug theo tiêu đề cho đẹp ("gioi-thieu" thay vì "index").
    slug:
      (/^(index|readme)$/i.test(basename(clean))
        ? slugify(fm.title ?? '') || 'tong-quan'
        : slugify(stripNumberPrefix(basename(clean)).name)) || 'bai',
    title: fm.sidebarTitle ?? fm.title ?? humanize(basename(clean)),
  };
}

// ---------- link & ảnh ----------

/**
 * Tìm bài được link tới: đường dẫn file tương đối (`./a.md`, `../b.mdx`), route tuyệt đối
 * của site gốc (`/docs/intro`, `/quickstart`) hoặc đường dẫn không đuôi.
 */
export function findLinkTarget(project: ImportProject, fromPath: string, url: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(url)) return null;
  const pathPart = url.split('#')[0].split('?')[0];
  if (!pathPart) return null;
  if (/\.(png|jpe?g|gif|webp|avif|svg|pdf|zip)$/i.test(pathPart)) return null;

  if (!pathPart.startsWith('/')) {
    const resolved = normalize(join(dirname(fromPath), pathPart));
    const bare = resolved.replace(DOC_RE, '');
    // Link ghi .md tới file .mdx (hoặc ngược lại) vẫn khớp.
    for (const candidate of [resolved, `${bare}.mdx`, `${bare}.md`, join(bare, 'index.md'), join(bare, 'index.mdx')]) {
      if (project.files.has(candidate) && DOC_RE.test(candidate)) return candidate;
    }
  }
  const route = pathPart
    .replace(DOC_RE, '')
    .replace(/^(?:\.\.?\/)+/, '')
    .replace(/^\/+|\/+$/g, '');
  const stripped = route
    .split('/')
    .map((s) => stripNumberPrefix(s).name)
    .join('/');
  for (const key of [route, stripped, route.replace(/^docs\//, ''), stripped.replace(/^docs\//, '')]) {
    const hit = project.routes.get(key);
    if (hit) return hit;
  }
  return null;
}

/** Tìm file ảnh trong gói: tương đối với bài, hoặc tuyệt đối từ thư mục tĩnh (`/img/a.png`). */
export function findAsset(project: ImportProject, fromPath: string, url: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) return null;
  const clean = decodeURIComponentSafe(url.split('#')[0].split('?')[0]);
  if (!clean) return null;
  const candidates = clean.startsWith('@site/')
    ? [normalize(join(project.root, clean.slice(6)))]
    : clean.startsWith('/')
      ? project.staticRoots.map((root) => normalize(join(root, clean.slice(1))))
      : [normalize(join(dirname(fromPath), clean))];
  return candidates.find((p) => project.files.has(p)) ?? null;
}

/** Đọc file snippet/partial được `import` trong bài. */
export function readImported(
  project: ImportProject,
  fromPath: string,
  importSource: string,
): { path: string; text: string } | null {
  const candidates = importSource.startsWith('/')
    ? [normalize(join(project.root, importSource.slice(1)))]
    : importSource.startsWith('@site/')
      ? [normalize(join(project.root, importSource.slice(6)))]
      : [normalize(join(dirname(fromPath), importSource))];
  for (const path of candidates) {
    const text = project.files.get(path)?.text;
    if (text !== undefined) return { path, text };
  }
  return null;
}

// ---------- tiện ích ----------

function uniqueSlugs(nodes: ImportNode[]): ImportNode[] {
  const seen = new Set<string>();
  for (const node of nodes) {
    let slug = node.slug;
    for (let i = 2; seen.has(slug); i += 1) slug = `${node.slug}-${i}`;
    node.slug = slug;
    seen.add(slug);
  }
  return nodes;
}

function readFrontmatter(text: string): Record<string, unknown> & {
  title?: string;
  sidebar_label?: string;
  sidebarTitle?: string;
  sidebar_position?: unknown;
  slug?: unknown;
  id?: unknown;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};
  try {
    const data = parseYaml(match[1]) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return {};
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const position = typeof data.sidebar_position === 'number' ? data.sidebar_position : Number(data.sidebar_position);
    return {
      ...data,
      title: str(data.title),
      sidebar_label: str(data.sidebar_label),
      sidebarTitle: str(data.sidebarTitle),
      sidebar_position: Number.isFinite(position) ? position : undefined,
    };
  } catch {
    return {};
  }
}

function humanize(name: string): string {
  const text = name.replace(/[-_]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : name;
}

function commonRoot(paths: string[]): string {
  if (paths.length === 0) return '';
  const split = paths.map((p) => p.split('/').slice(0, -1));
  const first = split[0];
  let length = 0;
  while (length < first.length && split.every((parts) => parts[length] === first[length])) length += 1;
  return first.slice(0, length).join('/');
}

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function join(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function relative(root: string, path: string): string {
  return root ? path.slice(root.length + 1) : path;
}

function isInside(path: string, dir: string): boolean {
  return dir === '' || path.startsWith(`${dir}/`);
}

/** Chuẩn hoá `a/./b/../c` -> `a/c`; không cho thoát ra ngoài gốc gói. */
export function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}
