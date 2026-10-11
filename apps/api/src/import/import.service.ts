import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  analyzeImport,
  convertProject,
  type ConvertedDoc,
  type ImportFile,
  type ImportNode,
  type ImportProject,
  type ImportWarning,
} from '@docshub/markdown';
import { unzipSync } from 'fflate';
import { AssetsService } from '../assets/assets.service.js';
import { IMAGE_TYPES, MAX_ASSET_BYTES } from '../assets/dto/asset.dto.js';
import type { AuthUser } from '../common/auth-user.js';
import { uniqueSlug } from '../common/unique-slug.js';
import { CategoriesService } from '../content/categories.service.js';
import { DocsService } from '../content/docs.service.js';
import { frozenError, TreeService } from '../content/tree.service.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import { CourseRole } from '../generated/prisma/enums.js';
import { SettingsService } from '../settings/settings.service.js';
import type { ImportDocsDto } from './dto/import.dto.js';

/** Giới hạn gói nhập: chặn file nén "bom" và request quá lớn. */
export const IMPORT_LIMITS = {
  uploadBytes: 50 * 1024 * 1024,
  files: 2000,
  zipEntries: 5000,
  unzippedBytes: 300 * 1024 * 1024,
  textFileBytes: 2 * 1024 * 1024,
  docs: 1000,
} as const;

const TEXT_RE = /\.(mdx?|json|ya?ml)$/i;
const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;
const MIME_BY_EXT: Record<string, keyof typeof IMAGE_TYPES> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};
const PLACEHOLDER_PREFIX = '/__docshub_import__/';

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

interface LoadedProject {
  files: ImportFile[];
  binaries: Map<string, Uint8Array>;
  warnings: ImportWarning[];
}

export interface ImportTreeItem {
  type: 'category' | 'doc';
  label: string;
  slug: string;
  path: string;
  source?: string;
  warnings?: number;
  children?: ImportTreeItem[];
}

/**
 * Nhập tài liệu Docusaurus/Mintlify: đọc gói (.zip hoặc nhiều file), dựng cây nhóm/bài,
 * chuyển MDX sang Markdown DocsHub, tải ảnh lên S3, rồi tạo nhóm/bài bằng chính các service
 * của Studio (cùng kiểm quyền, sinh slug, vị trí). `dryRun` chỉ trả báo cáo, không ghi.
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly access: CourseAccessService,
    private readonly tree: TreeService,
    private readonly categories: CategoriesService,
    private readonly docs: DocsService,
    private readonly assets: AssetsService,
    private readonly settings: SettingsService,
  ) {}

  async import(user: AuthUser, versionId: string, uploads: UploadedFile[], dto: ImportDocsDto) {
    const { version, role } = await this.access.requireVersion(user, versionId, CourseRole.EDITOR);
    if (version.frozenAt) throw frozenError();
    if (dto.publish && role !== CourseRole.OWNER) {
      throw new ForbiddenException('Chỉ chủ khoá được xuất bản ngay khi nhập; hãy bỏ chọn "Xuất bản luôn"');
    }
    if (!uploads?.length) throw new BadRequestException('Chọn file .zip, thư mục hoặc các file .md/.mdx để nhập');

    const { content } = await this.settings.get();
    if (!content.importEnabled) throw new ForbiddenException('Quản trị viên đã tắt chức năng nhập tài liệu');
    const loaded = this.load(uploads);
    const project = analyzeImport(loaded.files, dto.format);
    const docCount = countDocs(project.nodes);
    if (docCount === 0) {
      throw new BadRequestException('Không tìm thấy bài .md/.mdx nào để nhập (kiểm tra cấu trúc thư mục hoặc navigation)');
    }
    const maxDocs = Math.min(IMPORT_LIMITS.docs, content.importMaxDocs);
    if (docCount > maxDocs) {
      throw new BadRequestException(`Gói có ${docCount} bài, tối đa ${maxDocs} bài mỗi lần nhập`);
    }

    // Slug cấp ngoài cùng không được trùng với nội dung đang có trong phiên bản.
    const label = dto.categoryLabel?.trim();
    const wrapperSlug = label
      ? await uniqueSlug(label, (s) => this.tree.isSlugTaken(versionId, null, s), 'nhom-nhap')
      : null;
    if (!wrapperSlug) await this.freeTopLevelSlugs(versionId, project.nodes);

    const warnings = [...loaded.warnings, ...project.warnings];
    const placeholders = new Map<string, string>();
    const converted = convertProject(project, {
      basePath: wrapperSlug ? [wrapperSlug] : [],
      assetUrl: (zipPath) => {
        const placeholder = `${PLACEHOLDER_PREFIX}${placeholders.size}`;
        if (!placeholders.has(zipPath)) placeholders.set(zipPath, placeholder);
        return placeholders.get(zipPath)!;
      },
    });
    const byKey = new Map(converted.map((doc) => [doc.key, doc]));
    const report = {
      dryRun: dto.dryRun,
      format: project.flavor,
      root: project.root,
      wrapper: label && wrapperSlug ? { label, slug: wrapperSlug } : null,
      summary: {
        categories: countCategories(project.nodes) + (wrapperSlug ? 1 : 0),
        docs: docCount,
        images: placeholders.size,
        warnings: warnings.length + converted.reduce((n, d) => n + d.warnings.length, 0),
      },
      tree: toTree(project.nodes, byKey, wrapperSlug ? [wrapperSlug] : []),
      docs: converted
        .filter((d) => d.warnings.length > 0)
        .map((d) => ({ source: d.key, path: d.path, title: d.title, warnings: d.warnings })),
      skipped: project.skipped,
      warnings,
    };
    if (dto.dryRun) return { ...report, created: null };

    const assetUrls = await this.uploadImages(user, version.courseId, project, loaded, placeholders, warnings);
    const created = { categories: 0, docs: 0, published: 0, firstDocId: null as string | null };
    try {
      let parentId: string | null = null;
      if (label && wrapperSlug) {
        const wrapper = await this.categories.create(user, versionId, { label, slug: wrapperSlug });
        parentId = wrapper.id;
        created.categories += 1;
      }
      const docIds: string[] = [];
      await this.createNodes(user, versionId, project.nodes, parentId, byKey, assetUrls, docIds, created);
      // Xuất bản sau khi đã tạo đủ bài: link giữa các bài chỉ đổi được URL khi bài đích đã có.
      if (dto.publish) {
        const message = `Nhập từ ${project.flavor === 'mintlify' ? 'Mintlify' : 'Docusaurus'}`;
        for (const id of docIds) {
          await this.docs.publish(user, id, { message });
          created.published += 1;
        }
      }
    } catch (error) {
      this.logger.error(`Nhập dở vào version ${versionId}: ${(error as Error).message}`);
      throw new BadRequestException(
        `Nhập dở: đã tạo ${created.categories} nhóm, ${created.docs} bài trước khi gặp lỗi "${(error as Error).message}". ` +
          'Kiểm tra trong Studio rồi xoá phần đã tạo nếu muốn nhập lại.',
      );
    }
    return { ...report, warnings, created };
  }

  /** Giải nén .zip (hoặc nhận nhiều file / cả thư mục), chỉ giữ file chữ và ảnh. */
  private load(uploads: UploadedFile[]): LoadedProject {
    const files: ImportFile[] = [];
    const binaries = new Map<string, Uint8Array>();
    const warnings: ImportWarning[] = [];
    const decoder = new TextDecoder('utf-8');

    const add = (rawPath: string, size: number, data: Uint8Array | null) => {
      const path = safePath(rawPath);
      if (!path) return;
      if (TEXT_RE.test(path) && data) {
        if (data.byteLength > IMPORT_LIMITS.textFileBytes) {
          warnings.push({ message: `${path} lớn hơn 2 MB, đã bỏ qua`, line: null });
          return;
        }
        files.push({ path, size, text: decoder.decode(data).replace(/^﻿/, '').replace(/\r\n?/g, '\n') });
      } else {
        // File khác (ảnh, config .js) chỉ cần biết là có; dữ liệu ảnh giữ để tải lên.
        files.push({ path, size });
        if (data && IMAGE_RE.test(path)) binaries.set(path, data);
      }
    };

    for (const upload of uploads) {
      const name = upload.originalname;
      if (!/\.zip$/i.test(name)) {
        add(name, upload.size, upload.buffer);
        continue;
      }
      let entries = 0;
      let unzipped = 0;
      let tooLarge = false;
      let content: Record<string, Uint8Array>;
      try {
        content = unzipSync(new Uint8Array(upload.buffer), {
          filter: (entry) => {
            entries += 1;
            if (entry.name.endsWith('/') || !(TEXT_RE.test(entry.name) || IMAGE_RE.test(entry.name))) {
              if (!entry.name.endsWith('/')) add(entry.name, entry.originalSize, null);
              return false;
            }
            unzipped += entry.originalSize;
            if (entries > IMPORT_LIMITS.zipEntries || unzipped > IMPORT_LIMITS.unzippedBytes) tooLarge = true;
            return !tooLarge;
          },
        });
      } catch {
        throw new BadRequestException(`Không giải nén được ${name}: file .zip hỏng hoặc có mật khẩu`);
      }
      if (tooLarge) {
        throw new PayloadTooLargeException(
          `Gói ${name} quá lớn: tối đa ${IMPORT_LIMITS.zipEntries} file và ${IMPORT_LIMITS.unzippedBytes / 1024 / 1024} MB sau giải nén`,
        );
      }
      for (const [entryName, data] of Object.entries(content)) add(entryName, data.byteLength, data);
    }
    return { files, binaries, warnings };
  }

  private async freeTopLevelSlugs(versionId: string, nodes: ImportNode[]) {
    const used = new Set<string>();
    for (const node of nodes) {
      const base = node.slug;
      let slug = base;
      for (let n = 2; used.has(slug) || (await this.tree.isSlugTaken(versionId, null, slug)); n += 1) {
        slug = `${base}-${n}`;
      }
      node.slug = slug;
      used.add(slug);
    }
  }

  /** Tải ảnh lên S3; ảnh không hợp lệ thì giữ đường dẫn gốc và ghi cảnh báo. */
  private async uploadImages(
    user: AuthUser,
    courseId: string,
    project: ImportProject,
    loaded: LoadedProject,
    placeholders: Map<string, string>,
    warnings: ImportWarning[],
  ) {
    const urls = new Map<string, string>();
    for (const [zipPath, placeholder] of placeholders) {
      const ext = zipPath.split('.').pop()?.toLowerCase() ?? '';
      const mime = MIME_BY_EXT[ext];
      const data = loaded.binaries.get(zipPath);
      const original = `/${zipPath.slice(project.root ? project.root.length + 1 : 0)}`;
      if (!mime || !data) {
        warnings.push({ message: `Ảnh ${zipPath}: định dạng ${ext.toUpperCase()} không được hỗ trợ (SVG có thể chứa script)`, line: null });
        urls.set(placeholder, original);
        continue;
      }
      if (data.byteLength > MAX_ASSET_BYTES) {
        warnings.push({ message: `Ảnh ${zipPath} lớn hơn 10 MB, không tải lên`, line: null });
        urls.set(placeholder, original);
        continue;
      }
      const filename = zipPath.slice(zipPath.lastIndexOf('/') + 1);
      const asset = await this.assets.storeImported(user, courseId, { filename, mime, data });
      urls.set(placeholder, asset.url);
    }
    return urls;
  }

  private async createNodes(
    user: AuthUser,
    versionId: string,
    nodes: ImportNode[],
    parentId: string | null,
    docs: Map<string, ConvertedDoc>,
    assetUrls: Map<string, string>,
    docIds: string[],
    created: { categories: number; docs: number; published: number; firstDocId: string | null },
  ) {
    for (const node of nodes) {
      if (node.kind === 'category') {
        const category = await this.categories.create(user, versionId, {
          label: node.label.slice(0, 120),
          slug: node.slug,
          parentId: parentId ?? undefined,
          icon: node.icon ?? undefined,
          collapsed: node.collapsed,
          description: node.description?.slice(0, 500) ?? undefined,
        });
        created.categories += 1;
        await this.createNodes(user, versionId, node.children, category.id, docs, assetUrls, docIds, created);
        continue;
      }
      const converted = docs.get(node.key)!;
      const source = converted.markdown.replace(
        new RegExp(`${escapeRegExp(PLACEHOLDER_PREFIX)}\\d+`, 'g'),
        (placeholder) => assetUrls.get(placeholder) ?? placeholder,
      );
      const doc = await this.docs.create(user, versionId, {
        title: converted.title.slice(0, 200),
        categoryId: parentId ?? undefined,
        slug: node.slug,
        source,
      });
      created.docs += 1;
      created.firstDocId ??= doc.id;
      docIds.push(doc.id);
    }
  }
}

/** Đường dẫn trong gói: bỏ "./", chặn đường dẫn tuyệt đối và "..". */
function safePath(raw: string): string | null {
  const path = raw.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path)) return null;
  const parts = path.split('/');
  if (parts.some((p) => p === '..')) return null;
  return parts.filter((p) => p && p !== '.').join('/');
}

function countDocs(nodes: ImportNode[]): number {
  return nodes.reduce((n, node) => n + (node.kind === 'doc' ? 1 : countDocs(node.children)), 0);
}

function countCategories(nodes: ImportNode[]): number {
  return nodes.reduce((n, node) => n + (node.kind === 'category' ? 1 + countCategories(node.children) : 0), 0);
}

function toTree(nodes: ImportNode[], docs: Map<string, ConvertedDoc>, prefix: string[]): ImportTreeItem[] {
  return nodes.map((node) => {
    const path = [...prefix, node.slug].join('/');
    if (node.kind === 'category') {
      return { type: 'category', label: node.label, slug: node.slug, path, children: toTree(node.children, docs, [...prefix, node.slug]) };
    }
    const doc = docs.get(node.key);
    return { type: 'doc', label: doc?.title ?? node.title, slug: node.slug, path, source: node.key, warnings: doc?.warnings.length ?? 0 };
  });
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
