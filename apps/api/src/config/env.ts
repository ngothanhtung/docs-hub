import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

/** Biến môi trường, được kiểm tra khi khởi động. Thiếu/sai thì app dừng ngay. */
export class Env {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  PORT = 4999;

  @IsUrl({ require_tld: false })
  WEB_URL = 'http://localhost:3999';

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS = 30;

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  @Transform(toBoolean)
  @IsBoolean()
  ALLOW_SIGNUP = true;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  /** Bỏ trống khi dùng AWS S3; đặt URL khi dùng S3 giả lập (RustFS/MinIO). */
  @IsOptional()
  @IsUrl({ require_tld: false })
  S3_ENDPOINT?: string;

  @IsString()
  S3_REGION = 'ap-southeast-1';

  @IsString()
  S3_BUCKET: string;

  /** Bỏ trống trên máy chủ có IAM role (SDK tự lấy credential). */
  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;

  @Transform(toBoolean)
  @IsBoolean()
  S3_FORCE_PATH_STYLE = false;

  @IsUrl({ require_tld: false })
  MEILI_HOST = 'http://localhost:7700';

  @IsOptional()
  @IsString()
  MEILI_API_KEY?: string;

  /** Tên index; e2e dùng index riêng để không đụng dữ liệu dev. */
  @IsString()
  MEILI_INDEX = 'docshub_docs';
}

export function validateEnv(config: Record<string, unknown>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== ''),
  );
  const env = plainToInstance(Env, cleaned);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n  ');
    throw new Error(`Cấu hình môi trường không hợp lệ:\n  ${details}`);
  }
  return env;
}
