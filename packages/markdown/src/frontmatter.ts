import { isMap, parse, parseDocument } from 'yaml';

/** Các khoá frontmatter mà DocsHub hiểu; khoá khác vẫn được giữ nguyên. */
export interface Frontmatter {
  title?: string;
  description?: string;
  sidebar_label?: string;
  sidebar_position?: number;
  slug?: string;
  tags?: string[];
  reading_time?: number;
  draft?: boolean;
  [key: string]: unknown;
}

export class FrontmatterError extends Error {
  constructor(
    message: string,
    readonly line?: number,
  ) {
    super(message);
    this.name = 'FrontmatterError';
  }
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Tách khối YAML ở đầu file. Không có frontmatter thì `raw` là null. */
export function splitFrontmatter(source: string): {
  raw: string | null;
  body: string;
} {
  const match = FRONTMATTER_RE.exec(source);
  if (!match) return { raw: null, body: source };
  return { raw: match[1], body: source.slice(match[0].length) };
}

export function parseFrontmatter(source: string): {
  data: Frontmatter;
  body: string;
} {
  const { raw, body } = splitFrontmatter(source);
  return { data: raw === null ? {} : parseYamlFrontmatter(raw), body };
}

/** Parse và kiểm tra kiểu các khoá đã biết. `lineOffset` = dòng chứa YAML đầu tiên trong file. */
export function parseYamlFrontmatter(raw: string, lineOffset = 2): Frontmatter {
  let value: unknown;
  try {
    value = parse(raw);
  } catch (error) {
    const yamlLine = (error as { linePos?: [{ line: number }] }).linePos?.[0]
      ?.line;
    throw new FrontmatterError(
      `Frontmatter YAML không hợp lệ: ${(error as Error).message.split('\n')[0]}`,
      yamlLine === undefined ? undefined : yamlLine + lineOffset - 1,
    );
  }
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new FrontmatterError('Frontmatter phải là một object YAML');
  }

  const data = value as Frontmatter;
  expectType(data, 'title', 'string');
  expectType(data, 'description', 'string');
  expectType(data, 'sidebar_label', 'string');
  expectType(data, 'slug', 'string');
  expectType(data, 'sidebar_position', 'number');
  expectType(data, 'reading_time', 'number');
  expectType(data, 'draft', 'boolean');
  if (
    data.tags !== undefined &&
    !(Array.isArray(data.tags) && data.tags.every((t) => typeof t === 'string'))
  ) {
    throw new FrontmatterError('Frontmatter "tags" phải là danh sách chuỗi');
  }
  return data;
}

function expectType(
  data: Frontmatter,
  key: string,
  type: 'string' | 'number' | 'boolean',
) {
  if (data[key] !== undefined && typeof data[key] !== type) {
    throw new FrontmatterError(`Frontmatter "${key}" phải có kiểu ${type}`);
  }
}

/**
 * Ghi một khoá vào frontmatter mà vẫn giữ nguyên định dạng, comment của các khoá khác.
 * `value === undefined` thì xoá khoá. Tạo khối frontmatter mới nếu file chưa có.
 */
export function setFrontmatterField(
  source: string,
  key: string,
  value: unknown,
): string {
  const { raw, body } = splitFrontmatter(source);
  const doc = parseDocument(raw ?? '');
  if (doc.contents !== null && !isMap(doc.contents)) {
    throw new FrontmatterError('Frontmatter phải là một object YAML');
  }
  if (value === undefined) {
    doc.delete(key);
  } else {
    doc.set(key, value);
  }
  const yaml = isMap(doc.contents) && doc.contents.items.length > 0
    ? doc.toString().trimEnd()
    : '';
  if (yaml === '') return body;
  return `---\n${yaml}\n---\n${raw === null ? '\n' : ''}${body}`;
}
