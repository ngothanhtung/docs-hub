import type { StudioCategoryNode, StudioTreeNode } from '@/lib/api-types';

/** Con trực tiếp của một nhóm (null = gốc). */
export function childrenOf(tree: StudioTreeNode[], parentId: string | null): StudioTreeNode[] {
  if (parentId === null) return tree;
  return findCategory(tree, parentId)?.children ?? [];
}

export function findCategory(tree: StudioTreeNode[], id: string): StudioCategoryNode | null {
  for (const node of tree) {
    if (node.type !== 'category') continue;
    if (node.id === id) return node;
    const inner = findCategory(node.children, id);
    if (inner) return inner;
  }
  return null;
}

export function findParentId(tree: StudioTreeNode[], id: string, parentId: string | null = null): string | null | undefined {
  for (const node of tree) {
    if (node.id === id) return parentId;
    if (node.type === 'category') {
      const found = findParentId(node.children, id, node.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function replaceChildren(
  tree: StudioTreeNode[],
  parentId: string | null,
  children: StudioTreeNode[],
): StudioTreeNode[] {
  if (parentId === null) return children;
  return tree.map((node) =>
    node.type !== 'category'
      ? node
      : node.id === parentId
        ? { ...node, children }
        : { ...node, children: replaceChildren(node.children, parentId, children) },
  );
}

export interface CategoryOption {
  id: string;
  label: string;
  depth: number;
}

/** Danh sách nhóm bài dạng phẳng (thụt lề theo cấp) cho ô chọn nhóm. */
export function categoryOptions(
  tree: StudioTreeNode[],
  exclude?: string,
  depth = 1,
): CategoryOption[] {
  return tree.flatMap((node) =>
    node.type !== 'category' || node.id === exclude
      ? []
      : [{ id: node.id, label: node.label, depth }, ...categoryOptions(node.children, exclude, depth + 1)],
  );
}

/** Thứ tự mới của một cấp -> dữ liệu gửi PATCH /versions/:id/tree. Nhóm và bài dùng chung dãy vị trí. */
export function placementsFor(parentId: string | null, nodes: StudioTreeNode[]) {
  return {
    categories: nodes.flatMap((node, position) =>
      node.type === 'category' ? [{ id: node.id, parentId, position }] : [],
    ),
    docs: nodes.flatMap((node, position) =>
      node.type === 'doc' ? [{ id: node.id, categoryId: parentId, position }] : [],
    ),
  };
}
