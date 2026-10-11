import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Index, Meilisearch } from 'meilisearch';
import type { Env } from '../config/env.js';
import { buildTree, flattenDocs } from '../content/tree.js';
import { DocStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { splitSections } from './sections.js';

export interface SearchRecord {
  id: string;
  docId: string;
  courseId: string;
  versionId: string;
  path: string;
  title: string;
  anchor: string | null;
  heading: string | null;
  content: string;
  /** Thứ tự của bài trên sidebar, để kết quả cùng điểm hiện theo thứ tự đọc. */
  order: number;
  /** Mốc mở bài (ms). null = mở ngay. Lọc lúc tìm để bài hẹn giờ không lộ trước giờ. */
  publishAt: number | null;
}

/** Gom nhiều thay đổi liên tiếp (kéo-thả, xuất bản hàng loạt) thành một lần lập chỉ mục. */
const DEBOUNCE_MS = 1500;

/**
 * Đồng bộ bài đã xuất bản sang Meilisearch. Đơn vị là một version: mỗi khi nội dung hiển thị
 * cho học viên thay đổi (xuất bản, gỡ, sắp xếp, đổi slug...) thì lập lại chỉ mục cả version.
 */
@Injectable()
export class SearchIndexService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SearchIndexService.name);
  private readonly index: Index<SearchRecord>;
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    const client = new Meilisearch({
      host: config.get('MEILI_HOST', { infer: true }),
      apiKey: config.get('MEILI_API_KEY', { infer: true }),
    });
    this.index = client.index<SearchRecord>(config.get('MEILI_INDEX', { infer: true }));
  }

  async onApplicationBootstrap() {
    try {
      await this.index
        .updateSettings({
          searchableAttributes: ['heading', 'title', 'content'],
          filterableAttributes: ['versionId', 'courseId', 'docId', 'publishAt'],
          sortableAttributes: ['order'],
          rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness', 'order:asc'],
        })
        .waitTask();
      const stats = await this.index.getStats();
      if (stats.numberOfDocuments === 0) {
        this.reindexAll().catch((error: Error) => this.logger.error(`Lập chỉ mục ban đầu lỗi: ${error.message}`));
      }
    } catch (error) {
      this.logger.warn(`Không kết nối được Meilisearch, tìm kiếm sẽ không hoạt động: ${(error as Error).message}`);
    }
  }

  onModuleDestroy() {
    for (const timer of this.timers.values()) clearTimeout(timer);
  }

  /** Lên lịch lập chỉ mục lại một version (không chặn request đang xử lý). */
  scheduleVersion(versionId: string) {
    clearTimeout(this.timers.get(versionId));
    this.timers.set(
      versionId,
      setTimeout(() => {
        this.timers.delete(versionId);
        this.reindexVersion(versionId).catch((error: Error) =>
          this.logger.error(`Lập chỉ mục version ${versionId} lỗi: ${error.message}`),
        );
      }, DEBOUNCE_MS),
    );
  }

  async reindexVersion(versionId: string) {
    const [categories, docs] = await Promise.all([
      this.prisma.category.findMany({
        where: { versionId },
        select: {
          id: true,
          parentId: true,
          label: true,
          slug: true,
          position: true,
          icon: true,
          collapsed: true,
          description: true,
        },
      }),
      this.prisma.doc.findMany({
        where: { versionId, publishedRevisionId: { not: null }, status: { not: DocStatus.ARCHIVED } },
        select: {
          id: true,
          categoryId: true,
          slug: true,
          position: true,
          publishAt: true,
          version: { select: { courseId: true } },
          publishedRevision: { select: { title: true, html: true } },
        },
      }),
    ]);
    const ordered = flattenDocs(
      buildTree(
        categories,
        docs.map((d) => ({ id: d.id, categoryId: d.categoryId, slug: d.slug, position: d.position, label: d.id })),
      ),
    );
    const byId = new Map(docs.map((d) => [d.id, d]));
    // Bài có thể bị gỡ xuất bản giữa hai truy vấn: bỏ qua thay vì làm hỏng cả lượt lập chỉ mục.
    const published = (id: string) => byId.get(id)?.publishedRevision != null;

    const records: SearchRecord[] = ordered.filter((node) => published(node.id)).flatMap((node, order) => {
      const doc = byId.get(node.id)!;
      const title = doc.publishedRevision!.title;
      return splitSections(doc.publishedRevision!.html).map((section, i) => ({
        id: `${doc.id}_${i}`,
        docId: doc.id,
        courseId: doc.version.courseId,
        versionId,
        path: node.path,
        title,
        anchor: section.anchor,
        heading: section.heading,
        content: section.content,
        order,
        publishAt: doc.publishAt ? doc.publishAt.getTime() : null,
      }));
    });

    await this.index.deleteDocuments({ filter: `versionId = "${versionId}"` }).waitTask();
    if (records.length > 0) await this.index.addDocuments(records, { primaryKey: 'id' }).waitTask();
    this.logger.log(`Đã lập chỉ mục ${records.length} mục của ${ordered.length} bài (version ${versionId})`);
  }

  async removeVersion(versionId: string) {
    clearTimeout(this.timers.get(versionId));
    await this.index.deleteDocuments({ filter: `versionId = "${versionId}"` }).waitTask();
  }

  /** Lập lại toàn bộ chỉ mục (lần đầu chạy, hoặc admin gọi khi cần). */
  async reindexAll() {
    const versions = await this.prisma.version.findMany({ select: { id: true } });
    for (const version of versions) await this.reindexVersion(version.id);
    return { versions: versions.length };
  }

  /** Trạng thái chỉ mục cho trang Quản trị → Hệ thống. */
  async status() {
    try {
      const stats = await this.index.getStats();
      return { ok: true, index: this.index.uid, documents: stats.numberOfDocuments, isIndexing: stats.isIndexing };
    } catch (error) {
      return { ok: false, index: this.index.uid, error: (error as Error).message };
    }
  }

  search(versionId: string, query: string, limit: number) {
    const now = Date.now();
    return this.index.search<SearchRecord>(query, {
      filter: `versionId = "${versionId}" AND (publishAt IS NULL OR publishAt <= ${now})`,
      limit,
      attributesToRetrieve: ['docId', 'path', 'title', 'anchor', 'heading'],
      attributesToHighlight: ['title', 'heading', 'content'],
      attributesToCrop: ['content'],
      cropLength: 24,
      // Ký tự điều khiển làm dấu tô sáng; API thoát HTML rồi mới đổi thành <mark> (tránh XSS).
      highlightPreTag: '\u0001',
      highlightPostTag: '\u0002',
    });
  }
}
