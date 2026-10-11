import {
  buildTree,
  categoryDepth,
  findByPath,
  findCategoryCycle,
  flattenDocs,
  type TreeCategoryInput,
  type TreeDocInput,
} from './tree.js';

const category = (
  id: string,
  slug: string,
  position: number,
  parentId: string | null = null,
): TreeCategoryInput => ({
  id,
  parentId,
  label: slug,
  slug,
  position,
  icon: null,
  collapsed: false,
  description: null,
});

const doc = (
  id: string,
  slug: string,
  position: number,
  categoryId: string | null = null,
): TreeDocInput => ({ id, categoryId, slug, position, label: slug });

describe('buildTree', () => {
  const categories = [
    category('c2', 'kien-truc', 2),
    category('c1', 'gioi-thieu', 1),
    category('c3', 'nang-cao', 1, 'c2'),
    category('empty', 'trong', 9),
  ];
  const docs = [
    doc('d0', 'intro', 0),
    doc('d2', 'cai-dat', 2, 'c1'),
    doc('d1', 'nestjs-la-gi', 1, 'c1'),
    doc('d3', 'module', 0, 'c2'),
    doc('d4', 'guard', 0, 'c3'),
  ];

  it('sắp xếp theo position, lồng category và sinh path', () => {
    const tree = buildTree(categories, docs);
    expect(tree.map((n) => n.slug)).toEqual(['intro', 'gioi-thieu', 'kien-truc', 'trong']);
    expect(flattenDocs(tree).map((d) => d.path)).toEqual([
      'intro',
      'gioi-thieu/nestjs-la-gi',
      'gioi-thieu/cai-dat',
      'kien-truc/module',
      'kien-truc/nang-cao/guard',
    ]);
  });

  it('bỏ category rỗng khi pruneEmpty', () => {
    const tree = buildTree(categories, docs, { pruneEmpty: true });
    expect(tree.map((n) => n.slug)).not.toContain('trong');
  });

  it('tìm theo path và trả breadcrumb', () => {
    const tree = buildTree(categories, docs);
    const found = findByPath(tree, 'kien-truc/nang-cao/guard');
    expect(found?.node.id).toBe('d4');
    expect(found?.breadcrumb.map((c) => c.slug)).toEqual(['kien-truc', 'nang-cao']);
    expect(findByPath(tree, 'kien-truc/khong-co')).toBeNull();
    expect(findByPath(tree, 'intro/thua')).toBeNull();
  });
});

describe('findCategoryCycle', () => {
  it('phát hiện vòng lặp cha-con', () => {
    expect(findCategoryCycle(new Map([['a', 'b'], ['b', 'a']]))).not.toBeNull();
    expect(findCategoryCycle(new Map([['a', null], ['b', 'a'], ['c', 'b']]))).toBeNull();
  });

  it('tính độ sâu category', () => {
    const parents = new Map<string, string | null>([['a', null], ['b', 'a'], ['c', 'b']]);
    expect(categoryDepth('c', parents)).toBe(3);
  });
});
