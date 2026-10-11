import type {
  Code,
  Heading,
  Image,
  Link,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Text,
} from 'mdast';
import type { ContainerDirective, LeafDirective, TextDirective } from 'mdast-util-directive';
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export type ImportFlavor = 'docusaurus' | 'mintlify';

export interface ImportWarning {
  message: string;
  /** Dòng trong file gốc, bắt đầu từ 1. */
  line: number | null;
}

export interface ConvertOptions {
  flavor: ImportFlavor;
  /** Đường dẫn file trong gói nhập, để đọc snippet và báo lỗi. */
  path: string;
  /** Đổi URL link; `undefined` = giữ nguyên. */
  resolveLink?: (url: string, fromPath: string) => string | undefined;
  /** Đổi URL ảnh; `undefined` = giữ nguyên. */
  resolveImage?: (url: string, fromPath: string) => string | undefined;
  /** Đọc file khác trong gói (snippet Mintlify, partial Docusaurus). */
  readFile?: (importSource: string, fromPath: string) => { path: string; text: string } | null;
  /** Tiêu đề dùng khi file không có title trong frontmatter và không có h1. */
  fallbackTitle?: string;
}

export interface ConvertResult {
  /** Markdown DocsHub, kèm frontmatter đã chuẩn hoá. */
  markdown: string;
  title: string;
  frontmatter: Record<string, unknown>;
  warnings: ImportWarning[];
}

/** Tên admonition của Docusaurus không có trong DocsHub -> loại gần nhất. */
const ADMONITION_ALIASES: Record<string, string> = {
  caution: 'warning',
  important: 'info',
  success: 'check',
  secondary: 'note',
  note: 'note',
  tip: 'tip',
  info: 'info',
  warning: 'warning',
  danger: 'danger',
  check: 'check',
};

const CALLOUTS: Record<string, string> = {
  Note: 'note',
  Tip: 'tip',
  Info: 'info',
  Warning: 'warning',
  Danger: 'danger',
  Error: 'danger',
  Check: 'check',
  Callout: 'note',
};

/** Thẻ HTML/component chỉ bọc nội dung: bỏ thẻ, giữ nội dung, không cần cảnh báo. */
const TRANSPARENT = new Set([
  'p', 'div', 'span', 'section', 'article', 'center', 'small', 'sup', 'sub', 'u', 'mark',
  'Highlight', 'BrowserOnly', 'Fragment', 'React.Fragment', 'Visibility', 'View',
]);

/** Component chỉ có ý nghĩa trong site gốc (tự sinh nội dung): bỏ đi, có cảnh báo. */
const DROPPED = new Set(['DocCardList', 'DocCardLink', 'TOCInline', 'TOC', 'Prompt', 'Banner']);

const ICON_NAME_RE = /^[a-z][a-z0-9-]{0,63}$/;
const CODE_FLAGS = new Set(['lines', 'wrap', 'showLineNumbers', 'expandable', 'twoslash']);
const MAX_SNIPPET_DEPTH = 5;

type AnyNode = RootContent | Root;
type JsxElement = MdxJsxFlowElement | MdxJsxTextElement;

const PHRASING_TYPES = new Set([
  'text', 'emphasis', 'strong', 'delete', 'inlineCode', 'break', 'link', 'linkReference',
  'image', 'imageReference', 'footnoteReference', 'inlineMath', 'textDirective', 'html',
]);
const FLOW_PARENTS = new Set(['root', 'blockquote', 'listItem', 'containerDirective', 'footnoteDefinition']);
const PHRASING_PARENTS = new Set([
  'paragraph', 'heading', 'emphasis', 'strong', 'delete', 'link', 'linkReference', 'tableCell', 'textDirective',
]);

/**
 * Chuyển một trang Docusaurus (.md/.mdx) hoặc Mintlify (.mdx) sang Markdown DocsHub:
 * component MDX -> directive (callout, steps, tabs, card...), bỏ import/export,
 * nhúng snippet, đổi link/ảnh, chuẩn hoá frontmatter. Không chạy JavaScript của file.
 */
export function convertImportedDoc(source: string, options: ConvertOptions): ConvertResult {
  const warnings: ImportWarning[] = [];
  const { tree } = parseSource(source, options.flavor, warnings);
  const state: State = { options, warnings, imports: new Map(), depth: 0, warned: new Set() };

  const frontmatter = normalizeFrontmatter(tree, warnings);
  collectImports(tree, state);
  tree.children = transformChildren(tree, tree.children, state) as Root['children'];

  const h1 = tree.children.find((n): n is Heading => n.type === 'heading' && n.depth === 1);
  const title =
    (typeof frontmatter.title === 'string' && frontmatter.title.trim()) ||
    (h1 ? plainText(h1) : '') ||
    options.fallbackTitle ||
    'Bài nhập';
  frontmatter.title = title;

  const body = stringify(tree).trim();
  const yaml = stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd();
  return { markdown: `---\n${yaml}\n---\n\n${body}\n`, title, frontmatter, warnings };
}

interface State {
  options: ConvertOptions;
  warnings: ImportWarning[];
  /** Tên component -> đường dẫn import (để nhúng snippet/partial). */
  imports: Map<string, string>;
  depth: number;
  /** Cảnh báo chỉ báo một lần mỗi file. */
  warned: Set<string>;
  path?: string;
}

// ---------- đọc & ghi ----------

function parser(mdx: boolean) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective);
  return mdx ? processor.use(remarkMdx) : processor;
}

function parseSource(source: string, flavor: ImportFlavor, warnings: ImportWarning[]) {
  const prepared = flavor === 'docusaurus' ? legacyAdmonitionTitles(source) : source;
  try {
    return { tree: parser(true).parse(prepared) as Root, mdx: true };
  } catch (error) {
    const place = (error as { line?: number }).line ?? null;
    warnings.push({
      message: `Không đọc được dạng MDX (${(error as Error).message.split('\n')[0]}); đã nhập như Markdown thường, component JSX sẽ hiện dạng chữ`,
      line: place,
    });
    return { tree: parser(false).parse(prepared) as Root, mdx: false };
  }
}

function stringify(tree: Root): string {
  return unified()
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '_',
      strong: '*',
      fence: '`',
      fences: true,
      rule: '-',
      listItemIndent: 'one',
      incrementListMarker: true,
    })
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .stringify(tree);
}

/** Docusaurus cho viết `:::tip Tiêu đề`; DocsHub (và Docusaurus 3) dùng `:::tip[Tiêu đề]`. */
function legacyAdmonitionTitles(source: string): string {
  let fence: string | null = null;
  return source
    .split('\n')
    .map((line) => {
      const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
      if (fenceMatch) {
        if (fence === null) fence = fenceMatch[1][0];
        else if (fenceMatch[1][0] === fence) fence = null;
        return line;
      }
      if (fence) return line;
      return line.replace(/^(\s*:{3,})([a-z]+)[ \t]+(?!\{)(\S.*?)\s*$/, (_, colons, name, title) =>
        name in ADMONITION_ALIASES ? `${colons}${name}[${title}]` : _,
      );
    })
    .join('\n');
}

// ---------- frontmatter ----------

/** Giữ các khoá DocsHub hiểu; bỏ slug/sidebar_position (DocsHub tự xếp chỗ khi nhập) và khoá riêng của site gốc. */
function normalizeFrontmatter(tree: Root, warnings: ImportWarning[]): Record<string, unknown> {
  const index = tree.children.findIndex((n) => n.type === 'yaml');
  if (index === -1) return {};
  const node = tree.children[index] as { value: string; position?: { start: { line: number } } };
  tree.children.splice(index, 1);
  let data: unknown;
  try {
    data = parseYaml(node.value);
  } catch {
    warnings.push({ message: 'Frontmatter YAML lỗi cú pháp, đã bỏ', line: node.position?.start.line ?? 1 });
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const raw = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

  const title = text(raw.title);
  if (title) result.title = title;
  const description = text(raw.description);
  if (description) result.description = description;
  const label = text(raw.sidebar_label) ?? text(raw.sidebarTitle);
  if (label) result.sidebar_label = label;
  if (Array.isArray(raw.tags)) {
    const tags = raw.tags
      .map((tag) => (typeof tag === 'string' ? tag : text((tag as { label?: unknown })?.label)))
      .filter((tag): tag is string => Boolean(tag));
    if (tags.length) result.tags = tags;
  }
  if (typeof raw.draft === 'boolean') result.draft = raw.draft;
  return result;
}

// ---------- import/export của MDX ----------

function collectImports(tree: Root, state: State) {
  for (const node of tree.children) {
    if (node.type !== 'mdxjsEsm') continue;
    for (const match of node.value.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g)) {
      state.imports.set(match[1], match[2]);
    }
  }
}

// ---------- duyệt cây ----------

/** Component luôn nằm trong dòng; component khác viết gọn trên một dòng (`<Note>...</Note>`) vẫn là khối. */
const INLINE_COMPONENTS = new Set([
  'Tooltip', 'Badge', 'Icon', 'a', 'br', 'strong', 'b', 'em', 'i', 'code', 'kbd', 'img', 'span',
  'sup', 'sub', 'u', 'mark', 'Highlight', 'small',
]);

function transformChildren(parent: AnyNode, children: RootContent[], state: State): RootContent[] {
  const source = FLOW_PARENTS.has(parent.type) ? children.map(promoteBlockElement) : children;
  const out = source.flatMap((child) => transformNode(child, state));
  if (FLOW_PARENTS.has(parent.type)) return wrapPhrasing(out);
  if (PHRASING_PARENTS.has(parent.type)) {
    const phrasing = toPhrasing(out);
    // Bỏ `{/* #id */}` cuối heading để lại dấu cách thừa.
    const last = phrasing.at(-1);
    if ((parent.type === 'heading' || parent.type === 'paragraph') && last?.type === 'text') {
      last.value = last.value.trimEnd();
    }
    return phrasing as RootContent[];
  }
  return out;
}

/** Đoạn văn chỉ chứa một component khối (MDX coi là trong dòng khi viết trên một dòng) -> component khối. */
function promoteBlockElement(node: RootContent): RootContent {
  if (node.type !== 'paragraph') return node;
  const meaningful = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
  const only = meaningful[0];
  if (meaningful.length !== 1 || only.type !== 'mdxJsxTextElement' || only.name === null) return node;
  if (INLINE_COMPONENTS.has(only.name)) return node;
  return {
    ...only,
    type: 'mdxJsxFlowElement',
    children: only.children.length ? [{ type: 'paragraph', children: only.children }] : [],
  } as unknown as RootContent;
}

function transformNode(node: RootContent, state: State): RootContent[] {
  switch (node.type) {
    case 'mdxjsEsm':
      return [];
    case 'mdxFlowExpression':
    case 'mdxTextExpression': {
      const value = node.value.trim();
      if (!/^\/\*[\s\S]*\*\/$/.test(value)) {
        warn(state, node, `Đã bỏ biểu thức JavaScript {${truncate(value, 40)}}`);
      }
      return [];
    }
    case 'mdxJsxFlowElement':
    case 'mdxJsxTextElement':
      return convertElement(node, state);
    case 'containerDirective': {
      const alias = ADMONITION_ALIASES[node.name];
      if (alias) node.name = alias;
      node.children = transformChildren(node, node.children, state) as ContainerDirective['children'];
      return [node];
    }
    case 'code':
      fixCodeMeta(node, state);
      return [node];
    case 'link':
    case 'definition': {
      node.url = rewriteLink(node.url, state);
      if (node.type === 'link') node.children = transformChildren(node, node.children, state) as Link['children'];
      return [node];
    }
    case 'image':
      node.url = rewriteImage(node.url, state);
      return [node];
    case 'html':
      warnOnce(state, 'html', node, 'HTML thô không được hiển thị ở DocsHub; hãy đổi sang Markdown');
      return [node];
    default:
      if ('children' in node && Array.isArray(node.children)) {
        (node as { children: RootContent[] }).children = transformChildren(node, node.children as RootContent[], state);
      }
      return [node];
  }
}

// ---------- component MDX ----------

function convertElement(el: JsxElement, state: State): RootContent[] {
  const name = el.name;
  const inline = el.type === 'mdxJsxTextElement';
  // Con của component khối là các khối; con của component trong dòng là chữ.
  const kids = () =>
    transformChildren({ type: inline ? 'paragraph' : 'root' } as AnyNode, el.children as RootContent[], state);

  if (name === null || TRANSPARENT.has(name)) return kids();

  const callout = CALLOUTS[name];
  if (callout && !inline) {
    const icon = iconAttr(el, 'icon', state);
    return [container(callout, textLabel(attr(el, 'title')), { ...(icon ? { icon } : {}) }, kids())];
  }

  switch (name) {
    case 'Admonition': {
      const type = ADMONITION_ALIASES[String(attr(el, 'type') ?? 'note')] ?? 'note';
      return [container(type, textLabel(attr(el, 'title')), {}, kids())];
    }
    case 'Steps':
      return [container('steps', null, {}, kids())];
    case 'Step': {
      const icon = iconAttr(el, 'icon', state);
      return [container('step', textLabel(attr(el, 'title')), icon ? { icon } : {}, kids())];
    }
    case 'AccordionGroup':
      return [container('accordion-group', null, {}, kids())];
    case 'Accordion':
    case 'Expandable': {
      const icon = iconAttr(el, 'icon', state);
      const open = truthy(attr(el, 'defaultOpen'));
      return [
        container(name === 'Accordion' ? 'accordion' : 'expandable', textLabel(attr(el, 'title')), {
          ...(open ? { open: '' } : {}),
          ...(icon ? { icon } : {}),
        }, kids()),
      ];
    }
    case 'details':
      return [detailsToAccordion(el, state)];
    case 'summary':
      return wrapPhrasing([{ type: 'strong', children: toPhrasing(kids()) } as RootContent]);
    case 'CardGroup':
    case 'Columns': {
      const cols = Number.parseInt(String(attr(el, 'cols') ?? '2'), 10) || 2;
      return [container('columns', null, { cols: String(cols) }, kids())];
    }
    case 'Card':
      return [card(el, kids(), state)];
    case 'CodeGroup':
    case 'RequestExample':
    case 'ResponseExample':
      return [container('code-group', null, {}, kids())];
    case 'Tabs':
      return [container('tabs', null, {}, kids())];
    case 'Tab':
    case 'TabItem': {
      const label = String(attr(el, 'title') ?? attr(el, 'label') ?? attr(el, 'value') ?? 'Tab');
      return [container('tab', null, { label }, kids())];
    }
    case 'Frame': {
      const caption = attr(el, 'caption');
      return [container('frame', textLabel(caption), {}, kids())];
    }
    case 'Tooltip': {
      const tip = attr(el, 'tip') ?? attr(el, 'content');
      if (typeof tip !== 'string' || !inline) return kids();
      return [{ type: 'textDirective', name: 'tooltip', attributes: { tip }, children: toPhrasing(kids()) } as TextDirective];
    }
    case 'Badge': {
      const color = attr(el, 'color');
      const badge: TextDirective = {
        type: 'textDirective',
        name: 'badge',
        attributes: typeof color === 'string' ? { color } : {},
        children: toPhrasing(kids()),
      };
      return inline ? [badge] : wrapPhrasing([badge]);
    }
    case 'Icon': {
      const icon = iconAttr(el, 'icon', state);
      if (!icon) return [];
      const node: TextDirective = { type: 'textDirective', name: 'icon', attributes: { name: icon }, children: [] };
      return inline ? [node] : wrapPhrasing([node]);
    }
    case 'Tree':
      return [{ type: 'code', lang: 'tree', meta: null, value: treeLines(el, 0).join('\n') } as Code];
    case 'ParamField':
    case 'ResponseField':
      return fieldToParagraph(el, kids(), state);
    case 'Update': {
      warnOnce(state, 'Update', el, '<Update> được chuyển thành tiêu đề h2 + nội dung');
      const label = attr(el, 'label');
      const description = attr(el, 'description');
      return [
        ...(typeof label === 'string' ? [{ type: 'heading', depth: 2, children: [{ type: 'text', value: label }] } as Heading] : []),
        ...(typeof description === 'string' ? [paragraph([{ type: 'text', value: description }])] : []),
        ...kids(),
      ];
    }
    case 'CodeBlock':
      return [codeBlockElement(el)];
    case 'img':
    case 'Image':
    case 'IdealImage': {
      const src = attr(el, 'src') ?? attr(el, 'img');
      if (typeof src !== 'string') {
        warn(state, el, `<${name}> không có src dạng chuỗi, đã bỏ`);
        return [];
      }
      const image: Image = { type: 'image', url: rewriteImage(src, state), alt: String(attr(el, 'alt') ?? ''), title: null };
      return inline ? [image] : wrapPhrasing([image]);
    }
    case 'a': {
      const href = attr(el, 'href');
      const link: Link = {
        type: 'link',
        url: typeof href === 'string' ? rewriteLink(href, state) : '#',
        title: null,
        children: toPhrasing(kids()),
      };
      return inline ? [link] : wrapPhrasing([link]);
    }
    case 'br':
      return inline ? [{ type: 'break' }] : [];
    case 'strong':
    case 'b':
      return [{ type: 'strong', children: toPhrasing(kids()) } as RootContent];
    case 'em':
    case 'i':
      return [{ type: 'emphasis', children: toPhrasing(kids()) } as RootContent];
    case 'code':
    case 'kbd':
      return [{ type: 'inlineCode', value: plainText(el) } as RootContent];
    case 'iframe':
      return iframeToEmbed(el, state);
  }

  if (DROPPED.has(name)) {
    warn(state, el, `Đã bỏ <${name}> (chỉ có ý nghĩa trong site gốc)`);
    return [];
  }

  const snippet = state.imports.get(name);
  if (snippet && /\.mdx?$/.test(snippet)) {
    const inlined = inlineSnippet(name, snippet, el, state);
    if (inlined) return inline ? toPhrasing(inlined) as RootContent[] : inlined;
  }

  warn(state, el, `Component <${name}> không có ở DocsHub; đã giữ nội dung bên trong`);
  return kids();
}

function container(
  name: string,
  label: PhrasingContent[] | null,
  attributes: Record<string, string>,
  children: RootContent[],
): ContainerDirective {
  return {
    type: 'containerDirective',
    name,
    attributes,
    children: [
      ...(label?.length ? [{ type: 'paragraph', data: { directiveLabel: true }, children: label } as Paragraph] : []),
      ...wrapPhrasing(children),
    ] as ContainerDirective['children'],
  };
}

function card(el: JsxElement, children: RootContent[], state: State): ContainerDirective | LeafDirective {
  const attributes: Record<string, string> = {};
  const icon = iconAttr(el, 'icon', state);
  if (icon) attributes.icon = icon;
  const href = attr(el, 'href');
  if (typeof href === 'string') attributes.href = rewriteLink(href, state);
  const cta = attr(el, 'cta');
  if (typeof cta === 'string') attributes.cta = cta;
  if (truthy(attr(el, 'horizontal'))) attributes.horizontal = '';
  const img = attr(el, 'img');
  const body = [
    ...(typeof img === 'string'
      ? [paragraph([{ type: 'image', url: rewriteImage(img, state), alt: '', title: null }])]
      : []),
    ...children,
  ];
  const label = textLabel(attr(el, 'title'));
  if (body.length === 0) {
    return { type: 'leafDirective', name: 'card', attributes, children: label ?? [] };
  }
  return container('card', label, attributes, body);
}

function detailsToAccordion(el: JsxElement, state: State): ContainerDirective {
  let label: PhrasingContent[] | null = null;
  const rest: RootContent[] = [];
  for (const child of el.children as RootContent[]) {
    const summary = label === null ? findSummary(child) : null;
    if (summary) {
      label = toPhrasing(transformChildren({ type: 'paragraph' } as AnyNode, summary.children as RootContent[], state));
      continue;
    }
    rest.push(child);
  }
  const open = el.attributes.some((a) => a.type === 'mdxJsxAttribute' && a.name === 'open');
  return container('accordion', label, open ? { open: '' } : {}, transformChildren({ type: 'root' } as AnyNode, rest, state));
}

function findSummary(node: RootContent): JsxElement | null {
  if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'summary') return node;
  if (node.type === 'paragraph' && node.children.length === 1) return findSummary(node.children[0] as RootContent);
  return null;
}

function treeLines(el: JsxElement, depth: number): string[] {
  return (el.children as RootContent[]).flatMap((child) => {
    if (child.type !== 'mdxJsxFlowElement' && child.type !== 'mdxJsxTextElement') {
      return child.type === 'paragraph' ? child.children.flatMap((c) => treeLines({ ...el, children: [c] } as JsxElement, depth)) : [];
    }
    const itemName = String(attr(child, 'name') ?? '');
    if (child.name === 'Tree.Folder') return [`${'  '.repeat(depth)}${itemName}/`, ...treeLines(child, depth + 1)];
    if (child.name === 'Tree.File') return [`${'  '.repeat(depth)}${itemName}`];
    return treeLines(child, depth);
  });
}

function fieldToParagraph(el: JsxElement, children: RootContent[], state: State): RootContent[] {
  warnOnce(state, 'field', el, 'ParamField/ResponseField được chuyển thành đoạn văn mô tả');
  const name = ['path', 'body', 'query', 'header', 'name'].map((key) => attr(el, key)).find((v) => typeof v === 'string');
  const type = attr(el, 'type');
  const fallback = attr(el, 'default');
  const head: PhrasingContent[] = [
    { type: 'strong', children: [{ type: 'inlineCode', value: String(name ?? 'field') }] },
    ...(typeof type === 'string' ? [{ type: 'text', value: ' ' } as Text, { type: 'emphasis', children: [{ type: 'text', value: type }] } as PhrasingContent] : []),
    ...(truthy(attr(el, 'required')) ? [{ type: 'text', value: ' (bắt buộc)' } as Text] : []),
    ...(fallback !== undefined && fallback !== true ? [{ type: 'text', value: ' — mặc định: ' } as Text, { type: 'inlineCode', value: String(fallback) } as PhrasingContent] : []),
  ];
  return [paragraph(head), ...children];
}

function codeBlockElement(el: JsxElement): Code {
  const title = attr(el, 'title');
  const language = attr(el, 'language');
  const meta = [
    typeof title === 'string' ? `title="${title.replaceAll('"', "'")}"` : '',
    truthy(attr(el, 'showLineNumbers')) ? 'showLineNumbers' : '',
  ].filter(Boolean).join(' ');
  return {
    type: 'code',
    lang: typeof language === 'string' ? language : null,
    meta: meta || null,
    value: plainText(el).replace(/^\n+|\n+$/g, ''),
  };
}

function iframeToEmbed(el: JsxElement, state: State): RootContent[] {
  const src = String(attr(el, 'src') ?? '');
  const youtube = /(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(src);
  if (youtube) return [{ type: 'leafDirective', name: 'youtube', attributes: { id: youtube[1] }, children: [] } as LeafDirective];
  const vimeo = /player\.vimeo\.com\/video\/(\d+)/.exec(src);
  if (vimeo) return [{ type: 'leafDirective', name: 'vimeo', attributes: { id: vimeo[1] }, children: [] } as LeafDirective];
  warn(state, el, `Đã bỏ <iframe> tới ${truncate(src, 60) || '(không rõ)'}: chỉ nhúng được YouTube/Vimeo`);
  return [];
}

function inlineSnippet(name: string, importPath: string, el: JsxElement, state: State): RootContent[] | null {
  const from = state.path ?? state.options.path;
  const file = state.options.readFile?.(importPath, from);
  if (!file) {
    warn(state, el, `Không tìm thấy file của <${name}> (${importPath}), đã bỏ`);
    return [];
  }
  if (state.depth >= MAX_SNIPPET_DEPTH) {
    warn(state, el, `Snippet <${name}> lồng quá sâu, đã bỏ`);
    return [];
  }
  const inner: ImportWarning[] = [];
  const { tree } = parseSource(file.text, state.options.flavor, inner);
  tree.children = tree.children.filter((n) => n.type !== 'yaml');
  const nested: State = { ...state, imports: new Map(), depth: state.depth + 1, path: file.path, warnings: inner };
  collectImports(tree, nested);
  const children = transformChildren(tree, tree.children, nested);
  // Cảnh báo trong snippet gắn vào dòng dùng snippet ở file đang nhập.
  for (const warning of inner) warn(state, el, `Trong ${file.path}: ${warning.message}`);
  return children;
}

// ---------- code block ----------

/**
 * Mintlify viết tên file ngay sau ngôn ngữ (```ts app.ts) và `highlight={1,3}`;
 * DocsHub dùng `title="app.ts"` và `{1,3}`. Docusaurus chỉ cần bỏ cờ `live`.
 */
function fixCodeMeta(node: Code, state: State) {
  if (state.options.flavor === 'docusaurus') magicCommentsToMeta(node);
  if (!node.meta) return;
  const tokens = node.meta.match(/\w+=\{[^}]*\}|\w+="[^"]*"|\w+='[^']*'|\{[^}]*\}|\S+/g) ?? [];
  const kept: string[] = [];
  const titleWords: string[] = [];
  for (const token of tokens) {
    if (token === 'live' || token === 'noInline') continue;
    if (/^\{[\d,\s-]+\}$/.test(token) || CODE_FLAGS.has(token) || /^title=/.test(token)) {
      kept.push(token === 'expandable' || token === 'twoslash' ? '' : token);
      continue;
    }
    const highlight = /^highlight=\{([\d,\s-]+)\}$/.exec(token);
    if (highlight) {
      kept.push(`{${highlight[1].replace(/\s/g, '')}}`);
      continue;
    }
    if (/^(?:focus|icon|theme)=/.test(token)) {
      if (token.startsWith('focus=')) warnOnce(state, 'focus', node, 'Bỏ `focus=` trong code block; dùng chú thích `// [!code focus]` thay thế');
      continue;
    }
    if (/^\w+=/.test(token)) continue;
    if (state.options.flavor === 'mintlify') titleWords.push(token);
  }
  if (titleWords.length && !kept.some((t) => t.startsWith('title='))) {
    kept.unshift(`title="${titleWords.join(' ').replaceAll('"', "'")}"`);
  }
  node.meta = kept.filter(Boolean).join(' ') || null;
}

const MAGIC_COMMENT_RE =
  /^\s*(?:\/\/|#|<!--|\{\/\*|\/\*)\s*highlight-(next-line|start|end)\s*(?:-->|\*\/\}|\*\/)?\s*$/;

/**
 * Comment "phép thuật" của Docusaurus (`// highlight-next-line`, `// highlight-start` ... `// highlight-end`)
 * -> bỏ dòng comment, đánh dấu dòng bằng `{2,4-6}` trong meta (DocsHub hiểu, không phụ thuộc ngôn ngữ).
 */
function magicCommentsToMeta(node: Code) {
  if (!node.value.includes('highlight-')) return;
  const kept: string[] = [];
  const lines = new Set<number>();
  let nextLine = false;
  let inRange = false;
  for (const line of node.value.split('\n')) {
    const magic = MAGIC_COMMENT_RE.exec(line);
    if (magic) {
      if (magic[1] === 'next-line') nextLine = true;
      else inRange = magic[1] === 'start';
      continue;
    }
    kept.push(line);
    if (nextLine || inRange) lines.add(kept.length);
    nextLine = false;
  }
  if (lines.size === 0) return;
  node.value = kept.join('\n');
  node.meta = [node.meta, `{${toRanges([...lines])}}`].filter(Boolean).join(' ');
}

function toRanges(numbers: number[]): string {
  const ranges: string[] = [];
  for (let i = 0; i < numbers.length; i += 1) {
    let end = i;
    while (end + 1 < numbers.length && numbers[end + 1] === numbers[end] + 1) end += 1;
    ranges.push(end > i ? `${numbers[i]}-${numbers[end]}` : String(numbers[i]));
    i = end;
  }
  return ranges.join(',');
}

// ---------- link & ảnh ----------

function rewriteLink(url: string, state: State): string {
  return state.options.resolveLink?.(url, state.path ?? state.options.path) ?? url;
}

function rewriteImage(url: string, state: State): string {
  return state.options.resolveImage?.(url, state.path ?? state.options.path) ?? url;
}

// ---------- tiện ích ----------

function attr(el: JsxElement, name: string): string | true | undefined {
  const found = el.attributes.find(
    (a): a is MdxJsxAttribute => a.type === 'mdxJsxAttribute' && a.name === name,
  );
  if (!found) return undefined;
  if (found.value === null || found.value === undefined) return true;
  if (typeof found.value === 'string') return found.value;
  // Biểu thức {2}, {true}, {"x"}: chỉ nhận giá trị đơn giản, không chạy code.
  const expression = found.value.value.trim();
  if (expression === 'true') return true;
  if (expression === 'false') return undefined;
  const quoted = /^(['"`])([\s\S]*)\1$/.exec(expression);
  if (quoted) return quoted[2];
  if (/^-?\d+(\.\d+)?$/.test(expression)) return expression;
  return undefined;
}

function truthy(value: string | true | undefined): boolean {
  return value === true || value === 'true';
}

function iconAttr(el: JsxElement, name: string, state: State): string | undefined {
  const value = attr(el, name);
  if (typeof value !== 'string') return undefined;
  const icon = value.trim().toLowerCase();
  if (ICON_NAME_RE.test(icon)) return icon;
  warnOnce(state, 'icon', el, `Icon "${truncate(value, 30)}" không phải tên icon lucide, đã bỏ`);
  return undefined;
}

function textLabel(value: string | true | undefined): PhrasingContent[] | null {
  return typeof value === 'string' && value.trim() ? [{ type: 'text', value: value.trim() }] : null;
}

function paragraph(children: PhrasingContent[]): Paragraph {
  return { type: 'paragraph', children };
}

/** Gom các node trong dòng nằm lẫn giữa các khối thành đoạn văn. */
function wrapPhrasing(nodes: RootContent[]): RootContent[] {
  const out: RootContent[] = [];
  let run: PhrasingContent[] = [];
  const flush = () => {
    if (run.some((n) => n.type !== 'text' || n.value.trim())) out.push(paragraph(run));
    run = [];
  };
  for (const node of nodes) {
    if (PHRASING_TYPES.has(node.type) && node.type !== 'html') run.push(node as PhrasingContent);
    else {
      flush();
      out.push(node);
    }
  }
  flush();
  return out;
}

/** Trong ngữ cảnh một dòng: bỏ lớp đoạn văn, khối khác thì lấy chữ. */
function toPhrasing(nodes: RootContent[]): PhrasingContent[] {
  return nodes.flatMap((node): PhrasingContent[] => {
    if (PHRASING_TYPES.has(node.type)) return [node as PhrasingContent];
    if (node.type === 'paragraph' || node.type === 'heading') return node.children;
    const text = plainText(node);
    return text ? [{ type: 'text', value: text }] : [];
  });
}

function plainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { value?: unknown; children?: unknown[] };
  if (typeof n.value === 'string' && !('children' in n)) return n.value;
  return Array.isArray(n.children) ? n.children.map(plainText).join('') : '';
}

function warn(state: State, node: { position?: { start: { line: number } } }, message: string) {
  state.warnings.push({ message, line: node.position?.start.line ?? null });
}

function warnOnce(state: State, key: string, node: { position?: { start: { line: number } } }, message: string) {
  if (state.warned.has(key)) return;
  state.warned.add(key);
  warn(state, node, message);
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
