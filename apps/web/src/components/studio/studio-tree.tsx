'use client';

import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BookOpenIcon,
  ChevronRightIcon,
  EyeOffIcon,
  FilePlusIcon,
  FolderInputIcon,
  FileInputIcon,
  FolderPlusIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  CourseRole,
  StudioCategoryNode,
  StudioDocNode,
  StudioTreeNode,
} from '@/lib/api-types';
import { ClientApiError, clientApi, jsonBody } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { StatusDot, statusKind } from './doc-status';
import { ImportDialog } from './import-dialog';
import {
  CategoryDialog,
  type CategoryInput,
  ConfirmDialog,
  CreateDocDialog,
  MoveDialog,
} from './tree-dialogs';
import {
  categoryOptions,
  childrenOf,
  findParentId,
  placementsFor,
  replaceChildren,
} from './tree-utils';

const KNOWN_ICONS = new Set<string>(iconNames);
const MAX_CATEGORY_DEPTH = 3;

type DialogState =
  | { kind: 'create-doc'; parentId: string | null }
  | { kind: 'create-category'; parentId: string | null }
  | { kind: 'edit-category'; node: StudioCategoryNode }
  | { kind: 'move'; node: StudioTreeNode }
  | {
      kind: 'confirm';
      title: string;
      description: string;
      confirmLabel: string;
      destructive?: boolean;
      action: () => Promise<void>;
    };

interface TreeContext {
  courseSlug: string;
  versionSlug: string;
  activeDocId: string | undefined;
  canEdit: boolean;
  isOwner: boolean;
  open: (dialog: DialogState) => void;
  run: (action: () => Promise<unknown>, success: string) => Promise<void>;
}

/**
 * Cây nội dung của Studio: kéo-thả để sắp xếp trong cùng một cấp,
 * menu "..." để thêm, sửa, chuyển nhóm, lưu trữ, xoá.
 */
export function StudioTree(props: {
  tree: StudioTreeNode[];
  courseSlug: string;
  versionSlug: string;
  versionId: string;
  role: CourseRole;
  readOnly: boolean;
}) {
  const { courseSlug, versionSlug, versionId, role, readOnly } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [tree, setTree] = useState(props.tree);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // id cố định cho dnd-kit, nếu không id mô tả accessibility lệch giữa server và trình duyệt.
  const dndId = useId();
  useEffect(() => setTree(props.tree), [props.tree]);

  const activeDocId = /\/docs\/([^/]+)$/.exec(pathname)?.[1];
  const canEdit = !readOnly;
  const isOwner = role === 'OWNER' && !readOnly;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Chỉ cho thả vào vị trí cùng cấp với mục đang kéo.
  const collision: CollisionDetection = (args) => {
    const parentId = args.active.data.current?.parentId;
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.data.current?.parentId === parentId,
      ),
    });
  };

  const saveLevel = async (parentId: string | null, nodes: StudioTreeNode[]) => {
    await clientApi(`/versions/${versionId}/tree`, {
      method: 'PATCH',
      ...jsonBody(placementsFor(parentId, nodes)),
    });
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Có lỗi xảy ra');
      router.refresh();
    }
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const parentId = (active.data.current?.parentId as string | null) ?? null;
    const siblings = childrenOf(tree, parentId);
    const from = siblings.findIndex((n) => n.id === active.id);
    const to = siblings.findIndex((n) => n.id === over.id);
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(siblings, from, to);
    setTree((current) => replaceChildren(current, parentId, reordered));
    try {
      await saveLevel(parentId, reordered);
      router.refresh();
    } catch (error) {
      setTree(props.tree);
      toast.error(error instanceof ClientApiError ? error.message : 'Không lưu được thứ tự mới');
    }
  };

  const ctx: TreeContext = { courseSlug, versionSlug, activeDocId, canEdit, isOwner, open: setDialog, run };
  const close = (open: boolean) => !open && setDialog(null);
  const [importing, setImporting] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <span className="flex-1 text-sm font-medium">Nội dung</span>
        {canEdit ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Nhập từ Docusaurus hoặc Mintlify"
              aria-label="Nhập từ Docusaurus hoặc Mintlify"
              onClick={() => setImporting(true)}
            >
              <FileInputIcon />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialog({ kind: 'create-category', parentId: null })}
            >
              <FolderPlusIcon /> Nhóm
            </Button>
            <Button size="sm" onClick={() => setDialog({ kind: 'create-doc', parentId: null })}>
              <PlusIcon /> Bài mới
            </Button>
          </>
        ) : null}
      </div>

      <nav aria-label="Cây nội dung" className="min-h-0 flex-1 overflow-y-auto px-2 py-3 text-sm">
        {tree.length === 0 ? (
          <p className="px-2 py-6 text-center text-muted-foreground">Phiên bản này chưa có bài nào.</p>
        ) : (
          <DndContext id={dndId} sensors={sensors} collisionDetection={collision} onDragEnd={onDragEnd}>
            <Level nodes={tree} parentId={null} depth={1} ctx={ctx} />
          </DndContext>
        )}
      </nav>

      <TreeLegend />

      {dialog?.kind === 'create-doc' ? (
        <CreateDocDialog
          open
          onOpenChange={close}
          parentId={dialog.parentId}
          options={categoryOptions(tree)}
          onCreate={async ({ title, categoryId }) => {
            const doc = await clientApi<{ id: string }>(`/versions/${versionId}/docs`, {
              method: 'POST',
              ...jsonBody({ title, categoryId: categoryId ?? undefined }),
            });
            router.push(`/studio/${courseSlug}/${versionSlug}/docs/${doc.id}`);
            router.refresh();
          }}
        />
      ) : null}

      {dialog?.kind === 'create-category' || dialog?.kind === 'edit-category' ? (
        <CategoryDialog
          open
          onOpenChange={close}
          mode={dialog.kind === 'create-category' ? 'create' : 'edit'}
          initial={
            dialog.kind === 'edit-category'
              ? { label: dialog.node.label, icon: dialog.node.icon, description: dialog.node.description }
              : { parentId: dialog.parentId }
          }
          options={categoryOptions(tree).filter((o) => o.depth < MAX_CATEGORY_DEPTH)}
          onSubmit={async (input: CategoryInput) => {
            if (dialog.kind === 'edit-category') {
              await clientApi(`/categories/${dialog.node.id}`, {
                method: 'PATCH',
                ...jsonBody({ label: input.label, icon: input.icon, description: input.description }),
              });
              toast.success('Đã cập nhật nhóm bài');
            } else {
              await clientApi(`/versions/${versionId}/categories`, {
                method: 'POST',
                ...jsonBody({
                  label: input.label,
                  icon: input.icon ?? undefined,
                  description: input.description ?? undefined,
                  parentId: input.parentId ?? undefined,
                }),
              });
              toast.success('Đã tạo nhóm bài');
            }
            router.refresh();
          }}
        />
      ) : null}

      {dialog?.kind === 'move' ? (
        <MoveDialog
          open
          onOpenChange={close}
          label={dialog.node.label}
          currentParentId={findParentId(tree, dialog.node.id) ?? null}
          options={categoryOptions(tree, dialog.node.type === 'category' ? dialog.node.id : undefined)}
          onMove={async (target) => {
            const node = dialog.node;
            const siblings = childrenOf(tree, target).filter((n) => n.id !== node.id);
            await saveLevel(target, [...siblings, node]);
            toast.success('Đã chuyển');
            router.refresh();
          }}
        />
      ) : null}

      {dialog?.kind === 'confirm' ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirmLabel}
          destructive={dialog.destructive}
          onConfirm={async () => {
            await dialog.action();
            router.refresh();
          }}
        />
      ) : null}
      {canEdit ? (
        <ImportDialog
          open={importing}
          onOpenChange={setImporting}
          versionId={versionId}
          courseSlug={courseSlug}
          versionSlug={versionSlug}
          isOwner={isOwner}
        />
      ) : null}
    </div>
  );
}

function Level({
  nodes,
  parentId,
  depth,
  ctx,
}: {
  nodes: StudioTreeNode[];
  parentId: string | null;
  depth: number;
  ctx: TreeContext;
}) {
  return (
    <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
      <ul className={cn('flex flex-col gap-0.5', depth > 1 && 'mt-0.5 ml-4 border-l pl-1.5')}>
        {nodes.map((node) => (
          <SortableItem key={node.id} node={node} parentId={parentId} depth={depth} ctx={ctx} />
        ))}
      </ul>
    </SortableContext>
  );
}

function SortableItem({
  node,
  parentId,
  depth,
  ctx,
}: {
  node: StudioTreeNode;
  parentId: string | null;
  depth: number;
  ctx: TreeContext;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.id, data: { parentId }, disabled: !ctx.canEdit });
  const [open, setOpen] = useState(true);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 rounded-md bg-background opacity-80 shadow-md')}
    >
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md pr-1 hover:bg-muted',
          node.type === 'doc' && node.id === ctx.activeDocId && 'bg-primary/10 hover:bg-primary/10',
        )}
      >
        {ctx.canEdit ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Kéo để sắp xếp ${node.label}`}
            className="cursor-grab rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
        ) : (
          <span className="w-4" />
        )}

        {node.type === 'category' ? (
          <CategoryRow node={node} open={open} onToggle={() => setOpen(!open)} />
        ) : (
          <DocRow node={node} ctx={ctx} />
        )}

        <ItemMenu node={node} parentId={parentId} depth={depth} ctx={ctx} />
      </div>

      {node.type === 'category' && open ? (
        node.children.length > 0 ? (
          <Level nodes={node.children} parentId={node.id} depth={depth + 1} ctx={ctx} />
        ) : (
          <p className="ml-9 py-1 text-xs text-muted-foreground">Nhóm trống</p>
        )
      ) : null}
    </li>
  );
}

function CategoryRow({
  node,
  open,
  onToggle,
}: {
  node: StudioCategoryNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left font-medium"
    >
      <ChevronRightIcon className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      {node.icon && KNOWN_ICONS.has(node.icon) ? (
        <DynamicIcon name={node.icon as IconName} className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
      <span className="truncate">{node.label}</span>
    </button>
  );
}

function DocRow({ node, ctx }: { node: StudioDocNode; ctx: TreeContext }) {
  const kind = statusKind(node.meta);
  return (
    <Link
      href={`/studio/${ctx.courseSlug}/${ctx.versionSlug}/docs/${node.id}`}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2 py-1.5',
        kind === 'archived' && 'text-muted-foreground line-through',
        node.id === ctx.activeDocId && 'font-medium text-primary',
      )}
    >
      <StatusDot kind={kind} />
      <span className="truncate">{node.label}</span>
    </Link>
  );
}

function ItemMenu({
  node,
  parentId,
  depth,
  ctx,
}: {
  node: StudioTreeNode;
  parentId: string | null;
  depth: number;
  ctx: TreeContext;
}) {
  const readerUrl = `/courses/${ctx.courseSlug}/${ctx.versionSlug}/${node.path}`;
  const isDoc = node.type === 'doc';
  if (!ctx.canEdit && !(isDoc && node.meta.isPublished)) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Thao tác với ${node.label}`}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {node.type === 'category' && ctx.canEdit ? (
          <>
            <DropdownMenuItem onClick={() => ctx.open({ kind: 'create-doc', parentId: node.id })}>
              <FilePlusIcon /> Thêm bài vào nhóm
            </DropdownMenuItem>
            {depth < MAX_CATEGORY_DEPTH ? (
              <DropdownMenuItem onClick={() => ctx.open({ kind: 'create-category', parentId: node.id })}>
                <FolderPlusIcon /> Thêm nhóm con
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => ctx.open({ kind: 'edit-category', node })}>
              <PencilIcon /> Sửa nhóm
            </DropdownMenuItem>
          </>
        ) : null}

        {isDoc && node.meta.isPublished ? (
          <DropdownMenuItem render={<Link href={readerUrl} target="_blank" />}>
            <BookOpenIcon /> Xem trang đọc
          </DropdownMenuItem>
        ) : null}

        {ctx.canEdit ? (
          <DropdownMenuItem onClick={() => ctx.open({ kind: 'move', node })}>
            <FolderInputIcon /> Chuyển tới nhóm…
          </DropdownMenuItem>
        ) : null}

        {isDoc && ctx.isOwner ? (
          <>
            <DropdownMenuSeparator />
            {node.meta.isPublished && node.meta.status !== 'ARCHIVED' ? (
              <DropdownMenuItem
                onClick={() =>
                  ctx.open({
                    kind: 'confirm',
                    title: `Gỡ xuất bản "${node.label}"?`,
                    description: 'Học viên sẽ không thấy bài này nữa. Bản nháp và lịch sử vẫn giữ nguyên.',
                    confirmLabel: 'Gỡ xuất bản',
                    action: () => clientApi(`/docs/${node.id}/unpublish`, { method: 'POST' }).then(() => undefined),
                  })
                }
              >
                <EyeOffIcon /> Gỡ xuất bản
              </DropdownMenuItem>
            ) : null}
            {node.meta.status === 'ARCHIVED' ? (
              <DropdownMenuItem
                onClick={() =>
                  ctx.run(() => clientApi(`/docs/${node.id}/unarchive`, { method: 'POST' }), 'Đã bỏ lưu trữ')
                }
              >
                <ArchiveRestoreIcon /> Bỏ lưu trữ
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() =>
                  ctx.run(() => clientApi(`/docs/${node.id}/archive`, { method: 'POST' }), 'Đã lưu trữ bài viết')
                }
              >
                <ArchiveIcon /> Lưu trữ
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                ctx.open({
                  kind: 'confirm',
                  title: `Xoá vĩnh viễn "${node.label}"?`,
                  description: 'Bài viết và toàn bộ lịch sử revision sẽ bị xoá, không khôi phục được. Muốn ẩn bài thì dùng Lưu trữ.',
                  confirmLabel: 'Xoá vĩnh viễn',
                  destructive: true,
                  action: () => clientApi(`/docs/${node.id}`, { method: 'DELETE' }).then(() => undefined),
                })
              }
            >
              <Trash2Icon /> Xoá bài
            </DropdownMenuItem>
          </>
        ) : null}

        {node.type === 'category' && ctx.canEdit ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                ctx.open({
                  kind: 'confirm',
                  title: `Xoá nhóm "${node.label}"?`,
                  description: 'Chỉ xoá được nhóm trống. Hãy chuyển hoặc xoá các bài bên trong trước.',
                  confirmLabel: 'Xoá nhóm',
                  destructive: true,
                  action: () => clientApi(`/categories/${node.id}`, { method: 'DELETE' }).then(() => undefined),
                })
              }
            >
              <Trash2Icon /> Xoá nhóm
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TreeLegend() {
  const items = [
    ['published', 'Đã xuất bản'],
    ['changed', 'Có thay đổi'],
    ['review', 'Chờ duyệt'],
    ['draft', 'Nháp'],
  ] as const;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
      {items.map(([kind, label]) => (
        <span key={kind} className="flex items-center gap-1.5">
          <StatusDot kind={kind} /> {label}
        </span>
      ))}
    </div>
  );
}
