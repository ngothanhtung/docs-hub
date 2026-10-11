import type { Node } from 'unist';
import type { VFile } from 'vfile';

export type WarningRule =
  | 'broken-link'
  | 'image-alt'
  | 'heading-increment'
  | 'embed-id'
  | 'tabs-content'
  | 'component-content'
  | 'icon-name'
  | 'math';

export interface RenderWarning {
  rule: WarningRule;
  message: string;
  /** Dòng trong file nguồn (tính cả frontmatter), bắt đầu từ 1. */
  line: number | null;
}

export function addWarning(
  file: VFile,
  node: Node | undefined,
  rule: WarningRule,
  message: string,
) {
  const warnings = (file.data.warnings ??= []) as RenderWarning[];
  warnings.push({ rule, message, line: node?.position?.start.line ?? null });
}

declare module 'vfile' {
  interface DataMap {
    warnings: RenderWarning[];
  }
}
