'use client';

import type { EditorView } from '@codemirror/view';
import {
  BoldIcon,
  CodeIcon,
  FileCode2Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  LayoutGridIcon,
  MessageSquareWarningIcon,
  PanelsTopLeftIcon,
  QuoteIcon,
  SigmaIcon,
  TableIcon,
  WorkflowIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { BLOCKS, type BlockKey, insertBlock, insertLink, toggleLinePrefix, wrapSelection } from './editor-commands';

type Action = { label: string; icon: LucideIcon; shortcut?: string; run: (view: EditorView) => void };

const GROUPS: Action[][] = [
  [
    { label: 'Tiêu đề 2', icon: Heading2Icon, run: (v) => insertBlock(v, 'h2') },
    { label: 'Tiêu đề 3', icon: Heading3Icon, run: (v) => insertBlock(v, 'h3') },
  ],
  [
    { label: 'Đậm', icon: BoldIcon, run: (v) => wrapSelection(v, '**', '**', 'chữ đậm') },
    { label: 'Nghiêng', icon: ItalicIcon, run: (v) => wrapSelection(v, '_', '_', 'chữ nghiêng') },
    { label: 'Code trong dòng', icon: CodeIcon, run: (v) => wrapSelection(v, '`', '`', 'code') },
    { label: 'Link', icon: LinkIcon, run: insertLink },
  ],
  [
    { label: 'Danh sách', icon: ListIcon, run: (v) => toggleLinePrefix(v, '- ') },
    { label: 'Danh sách số', icon: ListOrderedIcon, run: (v) => toggleLinePrefix(v, '1. ') },
    { label: 'Checklist', icon: ListChecksIcon, run: (v) => toggleLinePrefix(v, '- [ ] ') },
    { label: 'Trích dẫn', icon: QuoteIcon, run: (v) => toggleLinePrefix(v, '> ') },
  ],
  [
    { label: 'Code block', icon: FileCode2Icon, run: (v) => insertBlock(v, 'code') },
    { label: 'Bảng', icon: TableIcon, run: (v) => insertBlock(v, 'table') },
    { label: 'Tabs', icon: PanelsTopLeftIcon, run: (v) => insertBlock(v, 'tabs') },
    { label: 'Sơ đồ Mermaid', icon: WorkflowIcon, run: (v) => insertBlock(v, 'mermaid') },
    { label: 'Công thức', icon: SigmaIcon, run: (v) => insertBlock(v, 'math') },
  ],
];

const ADMONITIONS: BlockKey[] = ['note', 'tip', 'info', 'warning', 'danger', 'check'];

/** Thành phần kiểu Mintlify. */
const COMPONENTS: BlockKey[] = ['steps', 'accordion', 'cards', 'codegroup', 'frame', 'tree', 'badge', 'tooltip', 'icon'];

export function EditorToolbar({
  view,
  disabled,
  onPickImage,
}: {
  view: EditorView | null;
  disabled: boolean;
  onPickImage: () => void;
}) {
  const off = disabled || !view;
  return (
    <div role="toolbar" aria-label="Định dạng" className="flex flex-wrap items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={off}
        title="Chèn ảnh (hoặc dán/kéo-thả ảnh vào editor)"
        aria-label="Chèn ảnh"
        onClick={onPickImage}
      >
        <ImageIcon />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-5" />
      {GROUPS.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5">
          {index > 0 ? <Separator orientation="vertical" className="mx-1 h-5" /> : null}
          {group.map((action) => (
            <Button
              key={action.label}
              variant="ghost"
              size="icon-sm"
              disabled={off}
              title={action.label}
              aria-label={action.label}
              onClick={() => view && action.run(view)}
            >
              <action.icon />
            </Button>
          ))}
        </div>
      ))}
      <Separator orientation="vertical" className="mx-1 h-5" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" disabled={off} aria-label="Chèn hộp ghi chú" />}
        >
          <MessageSquareWarningIcon /> Hộp ghi chú
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {ADMONITIONS.map((key) => (
            <DropdownMenuItem key={key} onClick={() => view && insertBlock(view, key)}>
              {BLOCKS[key].label}
              <span className="ml-auto font-mono text-xs text-muted-foreground">:::{key}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" disabled={off} aria-label="Chèn thành phần" />}
        >
          <LayoutGridIcon /> Thành phần
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {COMPONENTS.map((key) => (
            <DropdownMenuItem key={key} onClick={() => view && insertBlock(view, key)}>
              {BLOCKS[key].label}
              <span className="ml-auto font-mono text-xs text-muted-foreground">{BLOCKS[key].hint}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
