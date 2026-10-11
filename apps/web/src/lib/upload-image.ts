'use client';

import { ClientApiError, clientApi, jsonBody } from './client-api';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface CreatedUpload {
  asset: { id: string; url: string };
  upload: { method: 'PUT'; url: string; headers: Record<string, string> };
}

/** Lỗi kiểm tra trước khi upload (sai định dạng, quá lớn) — hiện thẳng cho người dùng. */
export class ImageRejectedError extends Error {}

export function checkImage(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new ImageRejectedError(`"${file.name}": chỉ nhận ảnh PNG, JPEG, GIF, WebP hoặc AVIF`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageRejectedError(`"${file.name}": ảnh tối đa 10 MB`);
  }
}

/**
 * Tải ảnh lên S3 theo 3 bước: xin URL đã ký từ API, PUT file thẳng lên S3, báo API xác nhận.
 * Trả về đường dẫn cố định để chèn vào Markdown.
 */
export async function uploadImage(courseId: string, file: File): Promise<string> {
  checkImage(file);
  const created = await clientApi<CreatedUpload>(`/courses/${courseId}/assets`, {
    method: 'POST',
    ...jsonBody({ filename: file.name, contentType: file.type, size: file.size }),
  });
  const put = await fetch(created.upload.url, {
    method: created.upload.method,
    headers: created.upload.headers,
    body: file,
  });
  if (!put.ok) throw new ClientApiError(put.status, 'Không tải được ảnh lên kho lưu trữ', null);
  await clientApi(`/assets/${created.asset.id}/complete`, { method: 'POST' });
  return created.asset.url;
}

/** Mô tả mặc định từ tên file: "so-do_di.png" -> "so do di". Tác giả nên sửa lại cho đúng nội dung. */
export function altFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'ảnh';
}
