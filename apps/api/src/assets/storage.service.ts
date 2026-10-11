import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** URL upload chỉ dùng được trong 10 phút. */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;
/** URL xem ảnh hết hạn sau 1 giờ (PRD mục 9); trình duyệt cache ít hơn thời hạn này. */
export const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

/** Bọc S3 (AWS hoặc S3 giả lập). Mọi file đều riêng tư, chỉ truy cập qua URL đã ký. */
@Injectable()
export class StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const accessKeyId = config.get('S3_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = config.get('S3_SECRET_ACCESS_KEY', { infer: true });
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.client = new S3Client({
      region: config.get('S3_REGION', { infer: true }),
      endpoint: config.get('S3_ENDPOINT', { infer: true }) || undefined,
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  /**
   * Dev: tự tạo bucket và CORS cho web để trình duyệt PUT thẳng lên S3.
   * Production: bucket và CORS cấu hình bằng hạ tầng, không tự sửa.
   */
  async onApplicationBootstrap() {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Đã tạo bucket ${this.bucket}`);
      } catch (error) {
        this.logger.warn(`Không kết nối được S3, upload ảnh sẽ lỗi: ${(error as Error).message}`);
        return;
      }
    }
    await this.client
      .send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: [this.config.get('WEB_URL', { infer: true })],
                AllowedMethods: ['PUT', 'GET'],
                AllowedHeaders: ['*'],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      )
      .catch((error: Error) => this.logger.warn(`Không đặt được CORS cho bucket: ${error.message}`));
  }

  /** URL để trình duyệt PUT file lên. Ký kèm Content-Type và Content-Length: không upload được file khác. */
  presignUpload(key: string, contentType: string, size: number) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: size }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
  }

  presignDownload(key: string) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    });
  }

  /** Thông tin file trên S3, null nếu chưa có. */
  async head(key: string): Promise<{ size: number; contentType: string | undefined } | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: result.ContentLength ?? 0, contentType: result.ContentType };
    } catch (error) {
      if (error instanceof NotFound || (error as { name?: string }).name === 'NotFound') return null;
      throw error;
    }
  }

  /** Bucket có truy cập được không, cho trang Quản trị → Hệ thống. */
  async status() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { ok: true, bucket: this.bucket };
    } catch (error) {
      return { ok: false, bucket: this.bucket, error: (error as Error).name || (error as Error).message };
    }
  }

  /** Ghi file từ phía server (nhập tài liệu từ gói .zip). */
  async put(key: string, body: Uint8Array, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ContentLength: body.byteLength }),
    );
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
