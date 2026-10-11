import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { apiFetchOrNotFound } from './api';
import type { CourseDetail, EditorDoc, StudioTreeNode } from './api-types';

/** Khoá học cho Studio. Học viên không vào được Studio: hiện "Không tìm thấy" như API. */
export const getStudioCourse = cache(async (courseSlug: string) => {
  const course = await apiFetchOrNotFound<CourseDetail>(`/courses/${encodeURIComponent(courseSlug)}`);
  if (course.role === 'LEARNER') notFound();
  return course;
});

export const getStudioContext = cache(async (courseSlug: string, versionSlug: string) => {
  const course = await getStudioCourse(courseSlug);
  const version = course.versions.find((v) => v.slug === versionSlug);
  if (!version) notFound();
  const tree = await apiFetchOrNotFound<StudioTreeNode[]>(`/versions/${version.id}/tree`);
  return { course, version, tree };
});

export function studioHref(courseSlug: string, versionSlug: string, docId?: string) {
  return `/studio/${courseSlug}/${versionSlug}${docId ? `/docs/${docId}` : ''}`;
}

/** Bài cho editor; generateMetadata và page dùng chung một lần gọi API. */
export const getEditorDoc = cache((docId: string) =>
  apiFetchOrNotFound<EditorDoc>(`/docs/${encodeURIComponent(docId)}`),
);
