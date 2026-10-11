import { defaultSchema } from 'rehype-sanitize';
import type { Options as SanitizeSchema } from 'rehype-sanitize';

const defaults = defaultSchema.attributes ?? {};

const CALLOUTS = 'note|tip|info|warning|danger|check';

/**
 * Allowlist cho HTML sinh từ Markdown của tác giả. Raw HTML trong Markdown đã bị bỏ
 * từ bước remark-rehype; schema này chặn thêm URL `javascript:` và thuộc tính lạ.
 * Chỉ mở đúng các class/thuộc tính mà plugin của DocsHub tạo ra.
 * Lưu ý: mỗi thuộc tính chỉ được khai báo một lần cho mỗi thẻ (khai báo sau đè khai báo trước),
 * nên className của thẻ có sẵn trong defaultSchema phải gộp chung một mục.
 */
export const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'figure', 'figcaption'],
  attributes: {
    ...defaults,
    div: [
      ...(defaults.div ?? []),
      [
        'className',
        'admonition',
        new RegExp(`^admonition-(?:${CALLOUTS}|heading|content)$`),
        'tabs',
        'tab',
        'code-group',
        'embed',
        'embed-youtube',
        'embed-vimeo',
        'step',
        'step-marker',
        'step-body',
        'step-title',
        'accordion-group',
        'accordion-content',
        'expandable-content',
        'columns',
        'card',
        new RegExp(`^card-(?:${CALLOUTS}|horizontal|icon|text|title|body|cta)$`),
      ],
      'dataLabel',
      'dataEmbedId',
      'dataCols',
    ],
    a: [
      ...(defaults.a ?? []).filter((attr) => !(Array.isArray(attr) && attr[0] === 'className')),
      ['className', 'data-footnote-backref', 'card', new RegExp(`^card-(?:${CALLOUTS}|horizontal)$`)],
    ],
    ol: [
      ...(defaults.ol ?? []).filter((attr) => !(Array.isArray(attr) && attr[0] === 'className')),
      ['className', 'contains-task-list', 'steps'],
    ],
    li: [['className', 'task-list-item', 'step']],
    details: [['className', 'accordion', 'expandable']],
    figure: [['className', 'frame']],
    span: [
      [
        'className',
        'icon',
        'badge',
        /^badge-(?:gray|blue|green|yellow|orange|red|purple)$/,
        'tooltip',
        'tooltip-content',
      ],
      'dataIcon',
      ['role', 'tooltip'],
    ],
    code: [
      ['className', /^language-[\w+#-]+$/, 'math-inline', 'math-display'],
      'metastring',
    ],
  },
};
