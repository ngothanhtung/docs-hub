'use server';

import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';

export interface CreateCourseState {
  error?: string;
}

export async function createCourse(
  _prev: CreateCourseState,
  form: FormData,
): Promise<CreateCourseState> {
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const versionLabel = String(form.get('versionLabel') ?? '').trim();
  if (!title) return { error: 'Vui lòng nhập tên khoá học' };

  let slug: string;
  try {
    const course = await apiFetch<{ slug: string }>('/courses', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: description || undefined,
        versionLabel: versionLabel || undefined,
      }),
    });
    slug = course.slug;
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  // Khoá mới chưa có bài: đưa thẳng vào Studio để soạn.
  redirect(`/studio/${slug}`);
}
