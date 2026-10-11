import { slugify } from '@docshub/markdown';

/**
 * Tạo slug không trùng: "provider", "provider-2", "provider-3"...
 * `isTaken` kiểm tra trong phạm vi phù hợp (cùng khoá, cùng nhóm bài...).
 */
export async function uniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
  fallback = 'bai-viet',
): Promise<string> {
  const root = slugify(base) || fallback;
  if (!(await isTaken(root))) return root;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${root}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`Không tạo được slug cho "${base}"`);
}
