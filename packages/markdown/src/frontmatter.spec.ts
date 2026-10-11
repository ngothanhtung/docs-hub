import { describe, expect, it } from 'vitest';
import { parseFrontmatter, setFrontmatterField, slugify, stripNumberPrefix } from './index.js';

describe('slugify', () => {
  it.each([
    ['Provider và Dependency Injection', 'provider-va-dependency-injection'],
    ['Đăng nhập & Phân quyền', 'dang-nhap-phan-quyen'],
    ['  NestJS là gì?  ', 'nestjs-la-gi'],
    ['Kiến trúc (v2)', 'kien-truc-v2'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('stripNumberPrefix', () => {
  it('tách tiền tố số', () => {
    expect(stripNumberPrefix('01-gioi-thieu')).toEqual({ name: 'gioi-thieu', position: 1 });
    expect(stripNumberPrefix('intro')).toEqual({ name: 'intro', position: null });
  });
});

describe('setFrontmatterField', () => {
  it('sửa một khoá, giữ nguyên comment và khoá khác', () => {
    const source = '---\ntitle: Provider # tiêu đề\nsidebar_position: 3\n---\n\nNội dung';
    const updated = setFrontmatterField(source, 'sidebar_position', 5);
    expect(updated).toBe('---\ntitle: Provider # tiêu đề\nsidebar_position: 5\n---\n\nNội dung');
  });

  it('tạo frontmatter khi file chưa có', () => {
    expect(setFrontmatterField('Nội dung', 'sidebar_position', 2)).toBe(
      '---\nsidebar_position: 2\n---\n\nNội dung',
    );
  });

  it('xoá khoá cuối cùng thì bỏ luôn khối frontmatter', () => {
    expect(setFrontmatterField('---\nslug: a\n---\nNội dung', 'slug', undefined)).toBe('Nội dung');
  });

  it('parse lại đúng sau khi sửa', () => {
    const updated = setFrontmatterField('---\ntags: [a]\n---\nX', 'title', 'Mới');
    expect(parseFrontmatter(updated)).toEqual({ data: { tags: ['a'], title: 'Mới' }, body: 'X' });
  });
});
