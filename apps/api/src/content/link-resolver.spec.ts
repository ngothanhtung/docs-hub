import { createLinkResolver } from './link-resolver.js';
import type { DocNode } from './tree.js';

const doc = (path: string): DocNode => ({
  type: 'doc',
  id: path,
  label: path,
  slug: path.split('/').at(-1)!,
  path,
});

describe('createLinkResolver', () => {
  const resolve = createLinkResolver(
    [doc('kien-truc/provider'), doc('nang-cao/provider'), doc('gioi-thieu/cai-dat')],
    '/courses/nestjs/2026',
  );

  it('đổi file .md có tiền tố số sang URL, giữ anchor', () => {
    expect(resolve('./02-cai-dat.md#yeu-cau', 'link')).toBe(
      '/courses/nestjs/2026/gioi-thieu/cai-dat#yeu-cau',
    );
  });

  it('ưu tiên bài có thư mục khớp khi trùng slug', () => {
    expect(resolve('../03-nang-cao/01-provider.md', 'link')).toBe(
      '/courses/nestjs/2026/nang-cao/provider',
    );
    expect(resolve('./provider.md', 'link')).toBe('/courses/nestjs/2026/kien-truc/provider');
  });

  it('trả null khi không có bài, bỏ qua ảnh và file khác', () => {
    expect(resolve('./khong-co.md', 'link')).toBeNull();
    expect(resolve('./assets/a.webp', 'image')).toBeUndefined();
    expect(resolve('./slides.pdf', 'link')).toBeUndefined();
  });
});
