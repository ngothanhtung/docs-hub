import type { ThemeId } from '../common/themes.js';

/**
 * Cấu hình hệ thống admin chỉnh trong trang Quản trị → Cài đặt. DB chỉ lưu phần khác mặc định
 * (system_settings.data); đọc ra luôn được trộn với mặc định nên thêm khoá mới không cần migration.
 */
export interface SystemSettings {
  general: {
    siteName: string;
    tagline: string;
    supportEmail: string | null;
  };
  auth: {
    allowSignup: boolean;
    googleLogin: boolean;
    /** Rỗng = mọi email; ví dụ ["softech.vn"] chỉ cho email @softech.vn tự đăng ký. */
    allowedEmailDomains: string[];
    defaultSystemRole: 'USER' | 'INSTRUCTOR';
  };
  appearance: {
    defaultTheme: ThemeId;
    defaultPrimaryColor: string | null;
  };
  content: {
    maxImageMb: number;
    importEnabled: boolean;
    importMaxDocs: number;
  };
  learning: {
    autoCompleteScrollPct: number;
    autoCompleteSeconds: number;
  };
  announcement: {
    enabled: boolean;
    message: string;
    tone: 'info' | 'warning' | 'danger';
  };
  maintenance: {
    enabled: boolean;
    message: string;
  };
}

export type SettingsSection = keyof SystemSettings;

export const SETTINGS_SECTIONS: SettingsSection[] = [
  'general',
  'auth',
  'appearance',
  'content',
  'learning',
  'announcement',
  'maintenance',
];

export function defaultSettings(env: { allowSignup: boolean }): SystemSettings {
  return {
    general: { siteName: 'DocsHub', tagline: 'Tài liệu khoá học dành cho học viên', supportEmail: null },
    auth: { allowSignup: env.allowSignup, googleLogin: true, allowedEmailDomains: [], defaultSystemRole: 'USER' },
    appearance: { defaultTheme: 'docshub', defaultPrimaryColor: null },
    content: { maxImageMb: 10, importEnabled: true, importMaxDocs: 1000 },
    learning: { autoCompleteScrollPct: 90, autoCompleteSeconds: 30 },
    announcement: { enabled: false, message: '', tone: 'info' },
    maintenance: { enabled: false, message: 'Hệ thống đang bảo trì, vui lòng quay lại sau ít phút.' },
  };
}

/** Trộn phần đã lưu vào mặc định theo từng nhóm; bỏ khoá lạ (dữ liệu cũ, nhập tay vào DB). */
export function mergeSettings(defaults: SystemSettings, stored: unknown): SystemSettings {
  const data = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const result = structuredClone(defaults);
  for (const section of SETTINGS_SECTIONS) {
    const saved = data[section];
    if (!saved || typeof saved !== 'object') continue;
    const target = result[section] as Record<string, unknown>;
    for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
      if (key in target && value !== undefined) target[key] = value;
    }
  }
  return result;
}

/** Phần khác mặc định, để lưu gọn vào DB. */
export function diffFromDefaults(defaults: SystemSettings, value: SystemSettings): Record<string, Record<string, unknown>> {
  const diff: Record<string, Record<string, unknown>> = {};
  for (const section of SETTINGS_SECTIONS) {
    for (const [key, v] of Object.entries(value[section])) {
      const d = (defaults[section] as Record<string, unknown>)[key];
      if (JSON.stringify(v) !== JSON.stringify(d)) (diff[section] ??= {})[key] = v;
    }
  }
  return diff;
}
