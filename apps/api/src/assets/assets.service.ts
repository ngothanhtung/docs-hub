import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import { CourseRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type CreateUploadDto, IMAGE_TYPES, MAX_ASSET_BYTES } from './dto/asset.dto.js';
import { SettingsService } from '../settings/settings.service.js';
import { StorageService } from './storage.service.js';

/**
 * Đường dẫn cố định dùng trong Markdown. Không bao giờ lưu URL S3 đã ký vào bài viết
 * (URL ký hết hạn sau 1 giờ); mỗi lần xem, API kiểm quyền rồi chuyển hướng tới URL ký mới.
 */
export function assetUrl(id: string) {
  return `/api/v1/assets/${id}`;
}

const assetSelect = {
  id: true,
  filename: true,
  mime: true,
  size: true,
  uploadedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  /** Bước 1: ghi nhận ảnh và cấp URL để trình duyệt tải thẳng lên S3. */
  async createUpload(user: AuthUser, courseId: string, dto: CreateUploadDto) {
    await this.access.requireCourse(user, courseId, CourseRole.EDITOR);
    await this.assertSize(dto.size, dto.filename);
    const key = `courses/${courseId}/${randomUUID()}.${IMAGE_TYPES[dto.contentType]}`;
    const asset = await this.prisma.asset.create({
      data: {
        courseId,
        key,
        filename: dto.filename,
        mime: dto.contentType,
        size: dto.size,
        uploadedById: user.id,
      },
      select: assetSelect,
    });
    return {
      asset: { ...asset, url: assetUrl(asset.id) },
      upload: {
        method: 'PUT' as const,
        url: await this.storage.presignUpload(key, dto.contentType, dto.size),
        headers: { 'content-type': dto.contentType },
      },
    };
  }

  /** Bước 2: xác nhận file đã nằm trên S3, đúng dung lượng đã khai báo. */
  async complete(user: AuthUser, assetId: string) {
    const asset = await this.findAsset(assetId);
    await this.access.requireCourse(user, asset.courseId, CourseRole.EDITOR);
    if (asset.uploadedAt) return { ...pick(asset), url: assetUrl(asset.id) };

    const stored = await this.storage.head(asset.key);
    if (!stored) throw new BadRequestException('File chưa được tải lên');
    if (stored.size !== asset.size) {
      await this.storage.delete(asset.key);
      await this.prisma.asset.delete({ where: { id: asset.id } });
      throw new BadRequestException('Dung lượng file không khớp, hãy tải lại');
    }
    const updated = await this.prisma.asset.update({
      where: { id: asset.id },
      data: { uploadedAt: new Date() },
      select: assetSelect,
    });
    return { ...updated, url: assetUrl(updated.id) };
  }

  /** URL ký để xem ảnh. Ai đọc được khoá học thì xem được ảnh của khoá. */
  async downloadUrl(user: AuthUser, assetId: string) {
    const asset = await this.findAsset(assetId);
    await this.access.requireCourse(user, asset.courseId, CourseRole.LEARNER);
    if (!asset.uploadedAt) throw new NotFoundException('Không tìm thấy ảnh');
    return this.storage.presignDownload(asset.key);
  }

  async list(user: AuthUser, courseId: string) {
    await this.access.requireCourse(user, courseId, CourseRole.EDITOR);
    const assets = await this.prisma.asset.findMany({
      where: { courseId, uploadedAt: { not: null } },
      select: { ...assetSelect, uploadedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return assets.map((asset) => ({ ...asset, url: assetUrl(asset.id) }));
  }

  /**
   * Lưu ảnh do server đọc từ gói nhập (không qua URL ký). Người gọi đã kiểm quyền EDITOR
   * và loại file; ở đây kiểm lại dung lượng cho chắc.
   */
  async storeImported(user: AuthUser, courseId: string, file: { filename: string; mime: keyof typeof IMAGE_TYPES; data: Uint8Array }) {
    await this.assertSize(file.data.byteLength, file.filename);
    const key = `courses/${courseId}/${randomUUID()}.${IMAGE_TYPES[file.mime]}`;
    await this.storage.put(key, file.data, file.mime);
    const asset = await this.prisma.asset.create({
      data: {
        courseId,
        key,
        filename: file.filename.slice(0, 255),
        mime: file.mime,
        size: file.data.byteLength,
        uploadedById: user.id,
        uploadedAt: new Date(),
      },
      select: { id: true },
    });
    return { id: asset.id, url: assetUrl(asset.id) };
  }

  /** Giới hạn dung lượng ảnh do admin đặt (1–10 MB; DTO chặn trần cứng 10 MB). */
  private async assertSize(bytes: number, filename: string) {
    const { maxImageMb } = (await this.settings.get()).content;
    if (bytes > Math.min(MAX_ASSET_BYTES, maxImageMb * 1024 * 1024)) {
      throw new BadRequestException(`Ảnh ${filename} lớn hơn ${maxImageMb} MB`);
    }
  }

  /** Xoá hẳn ảnh. Bài viết còn dùng ảnh này sẽ hiện ảnh hỏng. */
  async remove(user: AuthUser, assetId: string) {
    const asset = await this.findAsset(assetId);
    await this.access.requireCourse(user, asset.courseId, CourseRole.OWNER);
    await this.storage.delete(asset.key);
    await this.prisma.asset.delete({ where: { id: asset.id } });
  }

  private async findAsset(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Không tìm thấy ảnh');
    return asset;
  }
}

function pick(asset: { id: string; filename: string; mime: string; size: number; uploadedAt: Date | null; createdAt: Date }) {
  const { id, filename, mime, size, uploadedAt, createdAt } = asset;
  return { id, filename, mime, size, uploadedAt, createdAt };
}
