import 'server-only';
import { cache } from 'react';
import { apiFetchOrNotFound } from './api';
import type { ReaderTree, TreeNode } from './api-types';

/** Cây sidebar của một version (bỏ trống = version mặc định của học viên). Gọi một lần mỗi request. */
export const getReaderTree = cache((courseSlug: string, versionSlug?: string) => {
  const query = versionSlug ? `?version=${encodeURIComponent(versionSlug)}` : '';
  return apiFetchOrNotFound<ReaderTree>(`/read/${encodeURIComponent(courseSlug)}/tree${query}`);
});

export function readerHref(courseSlug: string, versionSlug: string, path = '') {
  return `/courses/${courseSlug}/${versionSlug}${path ? `/${path}` : ''}`;
}

/** Bài đầu tiên theo thứ tự sidebar, để mở khi vào trang khoá học. */
export function firstDocPath(tree: TreeNode[]): string | null {
  for (const node of tree) {
    if (node.type === 'doc') return node.path;
    const inner = firstDocPath(node.children);
    if (inner) return inner;
  }
  return null;
}
