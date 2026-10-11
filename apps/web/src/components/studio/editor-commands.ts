import { type Completion, type CompletionContext, snippet } from '@codemirror/autocomplete';
import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

interface BlockDef {
  label: string;
  hint: string;
  template: string;
  /** Chèn ngay tại con trỏ (trong dòng) thay vì xuống dòng mới. */
  inline?: boolean;
}

/**
 * Khối chèn sẵn, dùng chung cho thanh công cụ và lệnh "/".
 * `${...}` là vị trí con trỏ nhảy tới bằng Tab (cú pháp snippet của CodeMirror).
 */
export const BLOCKS = {
  h2: { label: 'Tiêu đề 2', hint: '##', template: '## ${Tiêu đề}' },
  h3: { label: 'Tiêu đề 3', hint: '###', template: '### ${Tiêu đề}' },
  code: { label: 'Code block', hint: '```', template: '```${ts}\n${}\n```' },
  note: { label: 'Ghi chú', hint: ':::note', template: ':::note\n${}\n:::' },
  tip: { label: 'Mẹo', hint: ':::tip', template: ':::tip\n${}\n:::' },
  info: { label: 'Thông tin', hint: ':::info', template: ':::info\n${}\n:::' },
  warning: { label: 'Cảnh báo', hint: ':::warning', template: ':::warning\n${}\n:::' },
  danger: { label: 'Nguy hiểm', hint: ':::danger', template: ':::danger\n${}\n:::' },
  check: { label: 'Thành công', hint: ':::check', template: ':::check\n${}\n:::' },
  tabs: {
    label: 'Tabs',
    hint: '::::tabs',
    template: '::::tabs\n:::tab{label="${npm}"}\n${}\n:::\n:::tab{label="pnpm"}\n\n:::\n::::',
  },
  table: {
    label: 'Bảng',
    hint: '| |',
    template: '| ${Cột 1} | Cột 2 |\n| --- | --- |\n|  |  |',
  },
  mermaid: { label: 'Sơ đồ Mermaid', hint: '```mermaid', template: '```mermaid\ngraph LR\n  ${A} --> B\n```' },
  math: { label: 'Công thức', hint: '$$', template: '$$\n${}\n$$' },
  youtube: { label: 'Video YouTube', hint: '::youtube', template: '::youtube{id="${ID video}"}' },
  // Thành phần kiểu Mintlify (viết bằng directive, không dùng MDX).
  steps: {
    label: 'Các bước',
    hint: '::::steps',
    template: '::::steps\n:::step[${Bước 1}]\n\n:::\n:::step[Bước 2]\n\n:::\n::::',
  },
  accordion: {
    label: 'Accordion',
    hint: ':::accordion',
    template: ':::accordion[${Câu hỏi}]\n\n:::',
  },
  cards: {
    label: 'Thẻ (cards)',
    hint: '::::columns',
    template:
      '::::columns{cols=2}\n:::card[${Tiêu đề}]{icon="book-open" href="./bai-khac.md"}\nMô tả ngắn.\n:::\n:::card[Thẻ thứ hai]{icon="rocket"}\nMô tả ngắn.\n:::\n::::',
  },
  codegroup: {
    label: 'Nhóm code',
    hint: '::::code-group',
    template: '::::code-group\n```bash title="npm"\n${npm install @nestjs/core}\n```\n```bash title="pnpm"\npnpm add @nestjs/core\n```\n::::',
  },
  frame: { label: 'Khung ảnh', hint: ':::frame', template: ':::frame[${Chú thích}]\n![mô tả](./assets/anh.webp)\n:::' },
  tree: { label: 'Cây thư mục', hint: '```tree', template: '```tree\n${src}/\n  app.module.ts\n  users/\n    users.service.ts\n```' },
  badge: { label: 'Nhãn (badge)', hint: ':badge', template: ':badge[${Mới}]{color="green"}', inline: true },
  tooltip: { label: 'Chú giải (tooltip)', hint: ':tooltip', template: ':tooltip[${từ}]{tip="giải thích"}', inline: true },
  icon: { label: 'Icon', hint: ':icon', template: ':icon{name="${rocket}"}', inline: true },
} as const satisfies Record<string, BlockDef>;

export type BlockKey = keyof typeof BLOCKS;

/** Chèn khối ở dòng mới (nếu dòng hiện tại đã có chữ) rồi đặt con trỏ vào chỗ cần gõ. */
export function insertBlock(view: EditorView, key: BlockKey) {
  const { from, to } = view.state.selection.main;
  const block: BlockDef = BLOCKS[key];
  if (block.inline) {
    snippet(block.template)(view, null, from, to);
    view.focus();
    return;
  }
  const line = view.state.doc.lineAt(from);
  const prefix = line.text.trim() === '' ? '' : '\n\n';
  const at = prefix ? line.to : from;
  snippet(prefix + BLOCKS[key].template)(view, null, at, prefix ? line.to : to);
  view.focus();
}

/** Bọc vùng chọn, ví dụ **đậm**. Không chọn gì thì chèn chữ mẫu và chọn sẵn chữ đó. */
export function wrapSelection(view: EditorView, before: string, after: string, placeholder: string) {
  view.dispatch(
    view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to) || placeholder;
      return {
        changes: { from: range.from, to: range.to, insert: before + text + after },
        range: EditorSelection.range(range.from + before.length, range.from + before.length + text.length),
      };
    }),
  );
  view.focus();
}

/** Thêm/bỏ tiền tố đầu dòng cho mọi dòng đang chọn: "- ", "1. ", "> ", "- [ ] ". */
export function toggleLinePrefix(view: EditorView, prefix: string) {
  const { state } = view;
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    for (let n = state.doc.lineAt(range.from).number; n <= state.doc.lineAt(range.to).number; n += 1) {
      lines.add(n);
    }
  }
  const all = [...lines].map((n) => state.doc.line(n));
  const remove = all.every((line) => line.text.startsWith(prefix));
  view.dispatch({
    changes: all.map((line) =>
      remove
        ? { from: line.from, to: line.from + prefix.length, insert: '' }
        : { from: line.from, insert: prefix },
    ),
  });
  view.focus();
}

export function insertLink(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const text = view.state.sliceDoc(from, to) || 'chữ hiển thị';
  snippet(`[${text}](\${./bai-khac.md})`)(view, null, from, to);
  view.focus();
}

/** Lệnh "/" ở đầu dòng: gõ /tip, /code, /bang... để chèn khối. */
export function slashCommands(context: CompletionContext) {
  const word = context.matchBefore(/\/[\p{L}\w-]*/u);
  if (!word) return null;
  const line = context.state.doc.lineAt(context.pos);
  if (word.from !== line.from && !/\s/.test(line.text[word.from - line.from - 1] ?? '')) return null;

  const options: Completion[] = (Object.keys(BLOCKS) as BlockKey[]).map((key) => ({
    label: `/${key}`,
    displayLabel: BLOCKS[key].label,
    detail: BLOCKS[key].hint,
    type: 'keyword',
    apply: snippet(BLOCKS[key].template),
  }));
  return { from: word.from, options, validFor: /^\/[\p{L}\w-]*$/u };
}

/** Đưa con trỏ tới một dòng (bấm vào cảnh báo lint). */
export function goToLine(view: EditorView, lineNumber: number) {
  const line = view.state.doc.line(Math.min(Math.max(1, lineNumber), view.state.doc.lines));
  view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
  view.focus();
}
