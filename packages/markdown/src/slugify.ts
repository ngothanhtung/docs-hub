/**
 * Tạo slug ASCII từ tiêu đề tiếng Việt: bỏ dấu, đổi "đ" thành "d",
 * chỉ giữ chữ thường, số và dấu gạch ngang.
 *
 * slugify('Provider và Dependency Injection') === 'provider-va-dependency-injection'
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Bỏ tiền tố số dùng để sắp xếp kiểu Docusaurus: "01-gioi-thieu" -> "gioi-thieu".
 * Trả về cả vị trí nếu có, để dùng làm sidebar_position mặc định.
 */
export function stripNumberPrefix(name: string): {
  name: string;
  position: number | null;
} {
  const match = /^(\d+)[-_.\s]+(.+)$/.exec(name);
  if (!match) return { name, position: null };
  return { name: match[2], position: Number(match[1]) };
}
