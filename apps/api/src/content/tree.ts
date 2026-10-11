/** Dựng cây sidebar kiểu Docusaurus từ danh sách phẳng category + doc. Hàm thuần, không chạm DB. */

export interface TreeCategoryInput {
  id: string;
  parentId: string | null;
  label: string;
  slug: string;
  position: number;
  icon: string | null;
  collapsed: boolean;
  description: string | null;
}

export interface TreeDocInput {
  id: string;
  categoryId: string | null;
  slug: string;
  position: number;
  /** Nhãn hiển thị trên sidebar. */
  label: string;
  /** Thông tin thêm cho Studio (trạng thái, đã xuất bản...). */
  meta?: Record<string, unknown>;
}

export interface CategoryNode {
  type: 'category';
  id: string;
  label: string;
  slug: string;
  path: string;
  icon: string | null;
  collapsed: boolean;
  description: string | null;
  children: TreeNode[];
}

export interface DocNode {
  type: 'doc';
  id: string;
  label: string;
  slug: string;
  path: string;
  meta?: Record<string, unknown>;
}

export type TreeNode = CategoryNode | DocNode;

export function buildTree(
  categories: TreeCategoryInput[],
  docs: TreeDocInput[],
  options: { pruneEmpty?: boolean } = {},
): TreeNode[] {
  const childCategories = groupBy(categories, (c) => c.parentId);
  const childDocs = groupBy(docs, (d) => d.categoryId);

  const build = (parentId: string | null, parentPath: string): TreeNode[] => {
    const items: Array<{ position: number; label: string; node: TreeNode }> = [];
    for (const category of childCategories.get(parentId) ?? []) {
      const path = joinPath(parentPath, category.slug);
      const children = build(category.id, path);
      if (options.pruneEmpty && children.length === 0) continue;
      items.push({
        position: category.position,
        label: category.label,
        node: {
          type: 'category',
          id: category.id,
          label: category.label,
          slug: category.slug,
          path,
          icon: category.icon,
          collapsed: category.collapsed,
          description: category.description,
          children,
        },
      });
    }
    for (const doc of childDocs.get(parentId) ?? []) {
      items.push({
        position: doc.position,
        label: doc.label,
        node: {
          type: 'doc',
          id: doc.id,
          label: doc.label,
          slug: doc.slug,
          path: joinPath(parentPath, doc.slug),
          ...(doc.meta ? { meta: doc.meta } : {}),
        },
      });
    }
    items.sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, 'vi'));
    return items.map((item) => item.node);
  };

  return build(null, '');
}

/** Danh sách bài theo đúng thứ tự đọc trên sidebar, dùng cho Prev/Next. */
export function flattenDocs(tree: TreeNode[]): DocNode[] {
  return tree.flatMap((node) => (node.type === 'doc' ? [node] : flattenDocs(node.children)));
}

/** Tìm node theo đường dẫn "kien-truc/provider", kèm breadcrumb các category cha. */
export function findByPath(
  tree: TreeNode[],
  path: string,
): { node: TreeNode; breadcrumb: CategoryNode[] } | null {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const breadcrumb: CategoryNode[] = [];
  let level = tree;
  for (const [index, segment] of segments.entries()) {
    const node = level.find((n) => n.slug === segment);
    if (!node) return null;
    if (index === segments.length - 1) return { node, breadcrumb };
    if (node.type !== 'category') return null;
    breadcrumb.push(node);
    level = node.children;
  }
  return null;
}

/**
 * Kiểm tra cây category sau khi đổi cha có bị vòng lặp (A là cha B, B là cha A) không.
 * Trả về id category nằm trong vòng lặp, hoặc null nếu hợp lệ.
 */
export function findCategoryCycle(parents: Map<string, string | null>): string | null {
  for (const start of parents.keys()) {
    const seen = new Set<string>();
    let current: string | null | undefined = start;
    while (current) {
      if (seen.has(current)) return start;
      seen.add(current);
      current = parents.get(current);
    }
  }
  return null;
}

/** Độ sâu của category (category gốc = 1). */
export function categoryDepth(id: string, parents: Map<string, string | null>): number {
  let depth = 0;
  let current: string | null | undefined = id;
  while (current) {
    depth += 1;
    current = parents.get(current);
  }
  return depth;
}

function joinPath(parent: string, slug: string) {
  return parent ? `${parent}/${slug}` : slug;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
