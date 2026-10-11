'use client';

import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';
import { useState } from 'react';
import { FormDialog } from '@/components/form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ClientApiError } from '@/lib/client-api';
import type { CategoryOption } from './tree-utils';

const KNOWN_ICONS = new Set<string>(iconNames);

function ParentSelect({
  options,
  defaultValue,
  rootLabel = 'Gốc (không thuộc nhóm nào)',
}: {
  options: CategoryOption[];
  defaultValue: string | null;
  rootLabel?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="parentId">Nằm trong nhóm</Label>
      <NativeSelect id="parentId" name="parentId" defaultValue={defaultValue ?? ''}>
        <option value="">{rootLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {`${'  '.repeat(option.depth - 1)}${option.label}`}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

export function CreateDocDialog({
  open,
  onOpenChange,
  parentId,
  options,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;
  options: CategoryOption[];
  onCreate: (input: { title: string; categoryId: string | null }) => Promise<void>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bài viết mới"
      description="Bài mới là bản nháp, học viên chỉ thấy sau khi được xuất bản."
      submitLabel="Tạo và mở editor"
      onSubmit={(form) =>
        onCreate({
          title: String(form.get('title')).trim(),
          categoryId: String(form.get('parentId')) || null,
        })
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="title">Tiêu đề</Label>
        <Input id="title" name="title" required maxLength={200} autoFocus placeholder="Ví dụ: Controller" />
      </div>
      <ParentSelect options={options} defaultValue={parentId} />
    </FormDialog>
  );
}

export interface CategoryInput {
  label: string;
  icon: string | null;
  description: string | null;
  parentId: string | null;
}

export function CategoryDialog({
  open,
  onOpenChange,
  mode,
  initial,
  options,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial: Partial<CategoryInput>;
  options: CategoryOption[];
  onSubmit: (input: CategoryInput) => Promise<void>;
}) {
  const [icon, setIcon] = useState(initial.icon ?? '');
  const iconValid = icon === '' || KNOWN_ICONS.has(icon);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Nhóm bài mới' : 'Sửa nhóm bài'}
      submitLabel={mode === 'create' ? 'Tạo nhóm' : 'Lưu'}
      onSubmit={async (form) => {
        if (!iconValid) throw new ClientApiError(400, `Không có icon "${icon}" trong bộ lucide`, null);
        await onSubmit({
          label: String(form.get('label')).trim(),
          icon: icon.trim() || null,
          description: String(form.get('description') ?? '').trim() || null,
          parentId: mode === 'create' ? String(form.get('parentId')) || null : (initial.parentId ?? null),
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="label">Tên nhóm</Label>
        <Input id="label" name="label" required maxLength={100} defaultValue={initial.label} autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="icon">Icon (tên trong bộ lucide)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value.trim().toLowerCase())}
            placeholder="layers, rocket, book-open..."
            aria-invalid={!iconValid}
          />
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border">
            {icon && iconValid ? <DynamicIcon name={icon as IconName} className="size-4" /> : null}
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Mô tả (hiện ở trang giới thiệu nhóm)</Label>
        <Textarea id="description" name="description" rows={2} maxLength={1000} defaultValue={initial.description ?? ''} />
      </div>
      {mode === 'create' ? <ParentSelect options={options} defaultValue={initial.parentId ?? null} /> : null}
    </FormDialog>
  );
}

export function MoveDialog({
  open,
  onOpenChange,
  label,
  currentParentId,
  options,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  currentParentId: string | null;
  options: CategoryOption[];
  onMove: (parentId: string | null) => Promise<void>;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Chuyển "${label}"`}
      description="Mục được đưa xuống cuối nhóm đích."
      submitLabel="Chuyển"
      onSubmit={(form) => onMove(String(form.get('parentId')) || null)}
    >
      <ParentSelect options={options} defaultValue={currentParentId} rootLabel="Gốc" />
    </FormDialog>
  );
}

export { ConfirmDialog } from '@/components/form-dialog';
