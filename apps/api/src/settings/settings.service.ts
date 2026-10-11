import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth-user.js';
import type { Env } from '../config/env.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateSettingsDto } from './dto/settings.dto.js';
import {
  defaultSettings,
  diffFromDefaults,
  mergeSettings,
  SETTINGS_SECTIONS,
  type SystemSettings,
} from './settings.schema.js';

/** Đọc cấu hình mỗi request là thừa: giữ trong bộ nhớ, tự đọc lại sau 30 giây (nhiều instance) hoặc ngay khi admin lưu. */
const CACHE_MS = 30_000;

@Injectable()
export class SettingsService {
  private cache: { value: SystemSettings; at: number } | null = null;
  private readonly defaults: SystemSettings;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.defaults = defaultSettings({ allowSignup: config.get('ALLOW_SIGNUP', { infer: true }) });
  }

  async get(): Promise<SystemSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const row = await this.prisma.systemSetting.findUnique({ where: { id: 1 } });
    const value = mergeSettings(this.defaults, row?.data);
    this.cache = { value, at: Date.now() };
    return value;
  }

  /** Bản đầy đủ cho trang quản trị, kèm thời điểm sửa gần nhất. */
  async forAdmin() {
    const row = await this.prisma.systemSetting.findUnique({
      where: { id: 1 },
      select: { updatedAt: true, updatedById: true },
    });
    return { settings: await this.get(), defaults: this.defaults, updatedAt: row?.updatedAt ?? null };
  }

  async update(user: AuthUser, dto: UpdateSettingsDto) {
    const current = await this.get();
    const next = structuredClone(current);
    const changed: string[] = [];
    for (const section of SETTINGS_SECTIONS) {
      const patch = dto[section] as Record<string, unknown> | undefined;
      if (!patch) continue;
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        const target = next[section] as Record<string, unknown>;
        if (JSON.stringify(target[key]) !== JSON.stringify(value)) changed.push(`${section}.${key}`);
        target[key] = value;
      }
    }
    if (changed.length === 0) return this.forAdmin();

    const data = diffFromDefaults(this.defaults, next) as Prisma.InputJsonValue;
    await this.prisma.systemSetting.upsert({
      where: { id: 1 },
      create: { id: 1, data, updatedById: user.id },
      update: { data, updatedById: user.id },
    });
    this.cache = { value: next, at: Date.now() };
    await this.audit.record({
      actorId: user.id,
      action: 'settings.update',
      targetType: 'settings',
      summary: `Đổi cấu hình: ${changed.join(', ')}`,
      meta: { changed },
    });
    return this.forAdmin();
  }

  /** Phần web cần biết trước khi đăng nhập (tên site, cho đăng ký không, thông báo...). Không có gì bí mật. */
  async publicSettings() {
    const s = await this.get();
    return {
      siteName: s.general.siteName,
      tagline: s.general.tagline,
      supportEmail: s.general.supportEmail,
      allowSignup: s.auth.allowSignup,
      googleLogin: s.auth.googleLogin,
      allowedEmailDomains: s.auth.allowedEmailDomains,
      defaultTheme: s.appearance.defaultTheme,
      defaultPrimaryColor: s.appearance.defaultPrimaryColor,
      maxImageMb: s.content.maxImageMb,
      importEnabled: s.content.importEnabled,
      announcement: s.announcement.enabled && s.announcement.message ? s.announcement : null,
      maintenance: s.maintenance.enabled ? { message: s.maintenance.message } : null,
    };
  }
}
