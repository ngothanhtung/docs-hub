import { BadRequestException, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { FrontmatterError, renderMarkdown, warmUpMarkdown } from '@docshub/markdown';
import { createLinkResolver } from './link-resolver.js';
import { flattenDocs } from './tree.js';
import { TreeService } from './tree.service.js';

export interface RenderContext {
  versionId: string;
  courseSlug: string;
  versionSlug: string;
}

/** URL trang đọc trên web Next.js. */
export function readerBasePath(courseSlug: string, versionSlug: string) {
  return `/courses/${courseSlug}/${versionSlug}`;
}

@Injectable()
export class RenderService implements OnApplicationBootstrap {
  constructor(private readonly tree: TreeService) {}

  async onApplicationBootstrap() {
    await warmUpMarkdown();
  }

  /**
   * Render bằng đúng pipeline của trang đọc. Link nội bộ được đổi theo cây bài
   * của version (trừ bài đã lưu trữ). Frontmatter lỗi -> 400 kèm số dòng.
   */
  async render(source: string, context: RenderContext) {
    const docs = flattenDocs(
      await this.tree.studioTree(context.versionId, { includeArchived: false }),
    );
    const resolveUrl = createLinkResolver(
      docs,
      readerBasePath(context.courseSlug, context.versionSlug),
    );
    try {
      return await renderMarkdown(source, { resolveUrl });
    } catch (error) {
      if (error instanceof FrontmatterError) {
        throw new BadRequestException({
          message: error.message,
          line: error.line ?? null,
          error: 'FrontmatterError',
        });
      }
      throw error;
    }
  }
}
