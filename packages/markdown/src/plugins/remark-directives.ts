import type { Paragraph, PhrasingContent, Root, RootContent } from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import type { VFile } from 'vfile';
import { visit, SKIP } from 'unist-util-visit';
import { addWarning } from '../warnings.js';
import {
  CALLOUT_TYPES,
  type CalloutType,
  type Directive,
  calloutIcon,
  element,
  isDirectiveLabel,
  setElement,
  toAccordion,
  toBadge,
  toCard,
  toCodeGroup,
  toColumns,
  toFrame,
  toIcon,
  toSteps,
  toTooltip,
} from './components.js';

/** Hộp ghi chú: 5 loại của Docusaurus + `check` của Mintlify. */
export const ADMONITION_TYPES = CALLOUT_TYPES;
export type AdmonitionType = CalloutType;

const DEFAULT_TITLES: Record<AdmonitionType, string> = {
  note: 'Ghi chú',
  tip: 'Mẹo',
  info: 'Thông tin',
  warning: 'Cảnh báo',
  danger: 'Nguy hiểm',
  check: 'Thành công',
};

const EMBED_ID_PATTERNS = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^\d{1,12}$/,
} as const;

/** Directive container dựng thành khối; `step`/`tab` nằm ngoài khối cha vẫn hiện nội dung. */
const CONTAINERS: Record<string, (node: ContainerDirective, file: VFile) => void> = {
  steps: toSteps,
  accordion: toAccordion,
  expandable: toAccordion,
  'accordion-group': (node) => setElement(node, 'div', { className: ['accordion-group'] }),
  columns: toColumns,
  'code-group': toCodeGroup,
  frame: toFrame,
};

/**
 * Biến directive (cú pháp `:::name`) thành HTML an toàn:
 * - `:::note|tip|info|warning|danger|check[Tiêu đề]{icon="..."}` -> callout
 * - `::::tabs` chứa các `:::tab{label="npm"}` -> tabs
 * - thành phần kiểu Mintlify: steps, accordion, columns + card, code-group, frame (khối);
 *   badge, icon, tooltip (trong dòng) — xem components.ts
 * - `::youtube{id="..."}`, `::vimeo{id="..."}` -> placeholder, rehype-embeds dựng iframe sau sanitize
 * Directive lạ được trả về dạng chữ để không nuốt nội dung của tác giả (ví dụ "a:b").
 */
export function remarkDirectives() {
  return (tree: Root, file: VFile) => {
    visit(tree, (node, index, parent) => {
      if (
        node.type !== 'containerDirective' &&
        node.type !== 'leafDirective' &&
        node.type !== 'textDirective'
      ) {
        return;
      }
      const directive = node as Directive;

      if (directive.type === 'containerDirective') {
        // Đã được khối cha (tabs, steps) dựng sẵn.
        if (directive.data?.hName) return;
        if ((ADMONITION_TYPES as readonly string[]).includes(directive.name)) {
          toAdmonition(directive, directive.name as AdmonitionType, file);
          return;
        }
        if (directive.name === 'tabs') {
          toTabs(directive, file);
          return;
        }
        const build = CONTAINERS[directive.name];
        if (build) {
          build(directive, file);
          return;
        }
        if (directive.name === 'tab' || directive.name === 'step') {
          setElement(directive, 'div', { className: [directive.name] });
          return;
        }
      }

      if (directive.type !== 'textDirective' && directive.name === 'card') {
        const link = toCard(directive, file);
        if (link) {
          parent!.children.splice(index!, 1, link as never);
          // Thăm lại node mới: link nội bộ được đổi URL, directive con (icon...) được xử lý.
          return index!;
        }
        return;
      }

      if (directive.type === 'textDirective') {
        switch (directive.name) {
          case 'badge':
            toBadge(directive);
            return;
          case 'tooltip':
            if (directive.attributes?.tip?.trim()) {
              toTooltip(directive);
              return;
            }
            break;
          case 'icon': {
            const replacement = toIcon(directive, file);
            parent!.children.splice(index!, 1, ...(replacement as never[]));
            return [SKIP, index! + replacement.length];
          }
        }
      }

      if (
        directive.type === 'leafDirective' &&
        (directive.name === 'youtube' || directive.name === 'vimeo')
      ) {
        const id = directive.attributes?.id ?? '';
        if (!EMBED_ID_PATTERNS[directive.name].test(id)) {
          addWarning(file, directive, 'embed-id', `ID ${directive.name} không hợp lệ: "${id}"`);
          parent!.children.splice(index!, 1);
          return [SKIP, index!];
        }
        setElement(directive, 'div', {
          className: ['embed', `embed-${directive.name}`],
          dataEmbedId: id,
        });
        directive.children = [];
        return;
      }

      const replacement = restoreAsText(directive);
      parent!.children.splice(index!, 1, ...replacement);
      return [SKIP, index! + replacement.length];
    });
  };
}

function toAdmonition(node: ContainerDirective, type: AdmonitionType, file: VFile) {
  const [first, ...rest] = node.children;
  const hasLabel = isDirectiveLabel(first);
  const titleChildren: PhrasingContent[] = hasLabel
    ? (first as Paragraph).children
    : [{ type: 'text', value: DEFAULT_TITLES[type] }];
  const content = hasLabel ? rest : node.children;
  const icon = calloutIcon(node, file);

  setElement(node, 'div', { className: ['admonition', `admonition-${type}`] });
  node.children = [
    {
      type: 'paragraph',
      children: icon ? [icon, ...titleChildren] : titleChildren,
      data: {
        hName: 'div',
        hProperties: { className: ['admonition-heading'] },
      },
    },
    element('div', { className: ['admonition-content'] }, content),
  ];
}

function toTabs(node: ContainerDirective, file: VFile) {
  setElement(node, 'div', { className: ['tabs'] });
  let tabIndex = 0;
  node.children = node.children.flatMap((child) => {
    if (child.type === 'containerDirective' && child.name === 'tab') {
      tabIndex += 1;
      const label = child.attributes?.label?.trim() || `Tab ${tabIndex}`;
      setElement(child, 'div', { className: ['tab'], dataLabel: label });
      return [child];
    }
    if (isDirectiveLabel(child)) return [];
    addWarning(
      file,
      child,
      'tabs-content',
      'Nội dung trong ::::tabs phải nằm trong một :::tab{label="..."}',
    );
    return [];
  });
}

function restoreAsText(node: Directive): RootContent[] {
  const label =
    node.type === 'textDirective'
      ? node.children
      : isDirectiveLabel(node.children[0])
        ? (node.children[0] as Paragraph).children
        : [];
  const prefix = node.type === 'textDirective' ? ':' : node.type === 'leafDirective' ? '::' : ':::';
  const head: PhrasingContent[] = [
    { type: 'text', value: `${prefix}${node.name}${label.length ? '[' : ''}` },
    ...label,
    ...(label.length ? [{ type: 'text' as const, value: ']' }] : []),
  ];
  if (node.type === 'textDirective') return head;
  if (node.type === 'leafDirective') return [{ type: 'paragraph', children: head }];
  const body = isDirectiveLabel(node.children[0])
    ? node.children.slice(1)
    : node.children;
  return [{ type: 'paragraph', children: head }, ...body];
}
