import type { BlockContent, Code, Link, Paragraph, PhrasingContent, RootContent } from 'mdast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import type { VFile } from 'vfile';
import { addWarning } from '../warnings.js';

/**
 * Thành phần soạn thảo kiểu Mintlify, viết bằng directive thay cho MDX
 * (không chạy JSX của tác giả). Mỗi hàm biến một directive thành cây mdast
 * có `hName` để remark-rehype dựng HTML; sanitize vẫn chạy sau đó.
 */

export type Directive = ContainerDirective | LeafDirective | TextDirective;

/** Tên icon lucide (`rocket`, `circle-check`); client kiểm tra lại với danh sách icon thật. */
const ICON_NAME_RE = /^[a-z][a-z0-9-]{0,63}$/;

export const CALLOUT_TYPES = ['note', 'tip', 'info', 'warning', 'danger', 'check'] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

export const BADGE_COLORS = ['gray', 'blue', 'green', 'yellow', 'orange', 'red', 'purple'] as const;

const MAX_COLUMNS = 4;

const LANGUAGE_LABELS: Record<string, string> = {
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  shellscript: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  csharp: 'C#',
  cpp: 'C++',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  prisma: 'Prisma',
  graphql: 'GraphQL',
  http: 'HTTP',
  dockerfile: 'Dockerfile',
};

const TITLE_META_RE = /\s*title=(?:"([^"]*)"|'([^']*)')/;

// ---------- khối ----------

/** `::::steps` chứa các `:::step[Tiêu đề]{icon="..."}` -> danh sách bước đánh số. */
export function toSteps(node: ContainerDirective, file: VFile) {
  setElement(node, 'ol', { className: ['steps'] });
  let stepIndex = 0;
  node.children = node.children.flatMap((child) => {
    if (child.type === 'containerDirective' && child.name === 'step') {
      stepIndex += 1;
      const { title, body } = splitTitle(child, `Bước ${stepIndex}`);
      const icon = iconFrom(child, file);
      setElement(child, 'li', { className: ['step'] });
      child.children = [
        element('div', { className: ['step-marker'] }, icon ? [paragraphOf([icon])] : []),
        element('div', { className: ['step-body'] }, [
          titleBlock('step-title', title),
          ...body,
        ]),
      ];
      return [child];
    }
    if (isDirectiveLabel(child)) return [];
    addWarning(file, child, 'component-content', 'Nội dung trong ::::steps phải nằm trong một :::step[Tiêu đề]');
    return [];
  });
}

/**
 * `:::accordion[Tiêu đề]{open icon="..."}` -> `<details>` gập/mở được, không cần JavaScript.
 * `:::expandable[...]` giống accordion nhưng gọn hơn, dùng cho phần "xem thêm".
 */
export function toAccordion(node: ContainerDirective, file: VFile) {
  const kind = node.name === 'expandable' ? 'expandable' : 'accordion';
  const { title, body } = splitTitle(node, kind === 'expandable' ? 'Xem thêm' : 'Chi tiết');
  const icon = iconFrom(node, file);
  const open = node.attributes != null && 'open' in node.attributes && node.attributes.open !== 'false';
  setElement(node, 'details', { className: [kind], ...(open ? { open: true } : {}) });
  node.children = [
    {
      type: 'paragraph',
      children: [...(icon ? [icon] : []), ...title],
      data: { hName: 'summary' },
    },
    element('div', { className: [`${kind}-content`] }, body),
  ];
}

/** `::::columns{cols=2}` -> lưới 1–4 cột, thường dùng để xếp các :::card. */
export function toColumns(node: ContainerDirective) {
  const cols = Math.min(MAX_COLUMNS, Math.max(1, Number.parseInt(node.attributes?.cols ?? '2', 10) || 2));
  setElement(node, 'div', { className: ['columns'], dataCols: String(cols) });
  node.children = node.children.filter((child) => !isDirectiveLabel(child));
}

/**
 * `:::card[Tiêu đề]{icon="boxes" href="./module.md" cta="Đọc tiếp" type="tip" horizontal}`
 * (hoặc `::card[...]{...}` không có nội dung). Có `href` thì cả thẻ là một link:
 * link nội bộ được đổi URL và kiểm tra hỏng như link thường.
 * Trả về node thay thế khi thẻ trở thành link.
 */
export function toCard(node: ContainerDirective | LeafDirective, file: VFile): Link | null {
  const { title, body } = splitTitle(node, '');
  const icon = iconFrom(node, file);
  const attributes = node.attributes ?? {};
  const type = attributes.type && (CALLOUT_TYPES as readonly string[]).includes(attributes.type) ? attributes.type : null;
  const className = [
    'card',
    ...(type ? [`card-${type}`] : []),
    ...('horizontal' in attributes ? ['card-horizontal'] : []),
  ];
  const href = attributes.href?.trim();
  const cta = attributes.cta?.trim();

  const children: RootContent[] = [
    ...(icon ? [element('div', { className: ['card-icon'] }, [paragraphOf([icon])])] : []),
    element('div', { className: ['card-text'] }, [
      ...(title.length ? [titleBlock('card-title', title)] : []),
      ...(body.length ? [element('div', { className: ['card-body'] }, body)] : []),
      ...(cta ? [titleBlock('card-cta', [{ type: 'text', value: cta }])] : []),
    ]),
  ];

  if (!href) {
    setElement(node, 'div', { className });
    node.children = children as never;
    return null;
  }
  return {
    type: 'link',
    url: href,
    title: null,
    children: children as never,
    position: node.position,
    data: { hName: 'a', hProperties: { className } },
  };
}

/**
 * `::::code-group` chứa nhiều code block -> tabs, nhãn tab lấy từ `title="..."`
 * hoặc tên ngôn ngữ. Dùng chung giao diện và bộ nhớ lựa chọn với ::::tabs.
 */
export function toCodeGroup(node: ContainerDirective, file: VFile) {
  setElement(node, 'div', { className: ['tabs', 'code-group'] });
  node.children = node.children.flatMap((child) => {
    if (child.type === 'code') {
      const label = codeLabel(child);
      // Tên đã nằm trên tab, bỏ khỏi meta để code block không lặp lại thanh tiêu đề.
      if (child.meta) child.meta = child.meta.replace(TITLE_META_RE, '').trim() || null;
      return [element('div', { className: ['tab'], dataLabel: label }, [child])];
    }
    if (isDirectiveLabel(child)) return [];
    addWarning(file, child, 'component-content', '::::code-group chỉ chứa code block (```)');
    return [];
  });
}

/** `:::frame[Chú thích]` hoặc `:::frame{caption="..."}` -> khung viền cho ảnh/video kèm chú thích. */
export function toFrame(node: ContainerDirective) {
  const { title, body } = splitTitle(node, '');
  const caption: PhrasingContent[] = title.length
    ? title
    : node.attributes?.caption
      ? [{ type: 'text', value: node.attributes.caption }]
      : [];
  setElement(node, 'figure', { className: ['frame'] });
  node.children = [
    ...body,
    ...(caption.length ? [{ type: 'paragraph', children: caption, data: { hName: 'figcaption' } } as Paragraph] : []),
  ] as ContainerDirective['children'];
}

// ---------- trong dòng ----------

/** `:badge[Mới]{color="green"}` -> nhãn nhỏ. */
export function toBadge(node: TextDirective) {
  const color = node.attributes?.color;
  const tone = color && (BADGE_COLORS as readonly string[]).includes(color) ? color : 'gray';
  setElement(node, 'span', { className: ['badge', `badge-${tone}`] });
}

/** `:icon{name="rocket"}` hoặc `:icon[rocket]` -> icon lucide, client vẽ icon thật. */
export function toIcon(node: TextDirective, file: VFile): PhrasingContent[] {
  const fromLabel = node.children.map((c) => ('value' in c ? c.value : '')).join('').trim();
  const icon = iconNode(node.attributes?.name ?? fromLabel, node, file);
  return icon ? [icon] : [];
}

/** `:tooltip[API]{tip="Application Programming Interface"}` -> chữ gạch chấm, rê chuột hoặc Tab để xem giải thích. */
export function toTooltip(node: TextDirective) {
  const tip = node.attributes?.tip?.trim();
  if (!tip) return;
  setElement(node, 'span', { className: ['tooltip'], tabIndex: 0 });
  node.children = [
    ...node.children,
    {
      type: 'emphasis',
      children: [{ type: 'text', value: tip }],
      data: { hName: 'span', hProperties: { className: ['tooltip-content'], role: 'tooltip' } },
    },
  ];
}

/** Icon tuỳ chọn cho callout: `:::tip{icon="rocket"}`. */
export function calloutIcon(node: ContainerDirective, file: VFile): PhrasingContent | null {
  return iconFrom(node, file);
}

// ---------- tiện ích ----------

export function isDirectiveLabel(node: RootContent | undefined): boolean {
  return (
    node?.type === 'paragraph' &&
    (node.data as { directiveLabel?: boolean } | undefined)?.directiveLabel === true
  );
}

export function setElement(node: Directive, tagName: string, properties: Record<string, unknown>) {
  node.data = { ...node.data, hName: tagName, hProperties: properties as never };
}

/** Node mdast "trung tính" chỉ để mdast-util-to-hast dựng thành element với children cho trước. */
export function element(
  tagName: string,
  properties: Record<string, unknown>,
  children: RootContent[],
): BlockContent {
  return {
    type: 'blockquote',
    children: children as never,
    data: { hName: tagName, hProperties: properties as never },
  };
}

/** Tiêu đề lấy từ `[nhãn]` (cho phép **đậm**, `code`), không có thì từ `title="..."`, cuối cùng là mặc định. */
function splitTitle(node: ContainerDirective | LeafDirective, fallback: string) {
  const [first, ...rest] = node.children as RootContent[];
  if (isDirectiveLabel(first)) {
    return { title: (first as Paragraph).children, body: node.type === 'leafDirective' ? [] : rest };
  }
  if (node.type === 'leafDirective') {
    return { title: node.children as PhrasingContent[], body: [] as RootContent[] };
  }
  const attr = node.attributes?.title?.trim() || fallback;
  return {
    title: attr ? ([{ type: 'text', value: attr }] as PhrasingContent[]) : [],
    body: node.children as RootContent[],
  };
}

function titleBlock(className: string, children: PhrasingContent[]): Paragraph {
  return { type: 'paragraph', children, data: { hName: 'div', hProperties: { className: [className] } } };
}

function paragraphOf(children: PhrasingContent[]): Paragraph {
  return { type: 'paragraph', children, data: { hName: 'span' } };
}

function iconFrom(node: Directive, file: VFile): PhrasingContent | null {
  const name = node.attributes?.icon;
  return name ? iconNode(name, node, file) : null;
}

function iconNode(name: string, node: Directive, file: VFile): PhrasingContent | null {
  const value = name.trim();
  if (!ICON_NAME_RE.test(value)) {
    addWarning(file, node, 'icon-name', `Tên icon không hợp lệ: "${name}" (dùng tên icon lucide, ví dụ "rocket")`);
    return null;
  }
  return {
    type: 'emphasis',
    children: [],
    data: { hName: 'span', hProperties: { className: ['icon'], dataIcon: value } },
  };
}

function codeLabel(code: Code): string {
  const title = code.meta ? TITLE_META_RE.exec(code.meta) : null;
  if (title) return (title[1] ?? title[2]).trim();
  if (!code.lang) return 'Code';
  return LANGUAGE_LABELS[code.lang.toLowerCase()] ?? code.lang;
}
