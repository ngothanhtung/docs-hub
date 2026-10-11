/**
 * Tách HTML bài viết (đã render, đã sanitize) thành các mục theo heading h2/h3 để lập chỉ mục tìm kiếm.
 * Mỗi mục là một kết quả tìm kiếm riêng, bấm vào nhảy thẳng tới đúng heading.
 */

export interface DocSection {
  /** id của heading (anchor), null = phần mở đầu trước heading đầu tiên. */
  anchor: string | null;
  heading: string | null;
  content: string;
}

const HEADING_RE = /<h([23])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
/** Giới hạn mỗi mục để bản ghi không quá lớn; phần đầu mục đủ cho tìm kiếm và trích đoạn. */
const MAX_SECTION_CHARS = 8000;

export function splitSections(html: string): DocSection[] {
  const sections: DocSection[] = [];
  let cursor = 0;
  let current: { anchor: string | null; heading: string | null } = { anchor: null, heading: null };

  for (const match of html.matchAll(HEADING_RE)) {
    pushSection(sections, current, html.slice(cursor, match.index));
    current = { anchor: match[2], heading: htmlToText(stripAnchor(match[3])) };
    cursor = match.index + match[0].length;
  }
  pushSection(sections, current, html.slice(cursor));
  return sections;
}

function pushSection(
  sections: DocSection[],
  meta: { anchor: string | null; heading: string | null },
  html: string,
) {
  const content = htmlToText(html).slice(0, MAX_SECTION_CHARS);
  // Bỏ phần mở đầu rỗng, nhưng giữ heading dù chưa có nội dung (vẫn tìm được theo tên heading).
  if (!content && meta.anchor === null) return;
  sections.push({ ...meta, content });
}

/** Bỏ ký tự "#" của rehype-autolink-headings ở cuối heading. */
function stripAnchor(html: string) {
  return html.replace(/<a\b[^>]*class="heading-anchor"[^>]*>[\s\S]*?<\/a>/g, '');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** HTML -> chữ thuần: bỏ thẻ, svg/style (KaTeX, Shiki), giải mã entity, gộp khoảng trắng. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(svg|style|script|annotation)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<span class="katex-mathml">[\s\S]*?<\/span>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith('#x')) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
      return ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
