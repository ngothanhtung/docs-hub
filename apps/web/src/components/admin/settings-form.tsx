'use client';

import {
  BellIcon,
  BookOpenCheckIcon,
  ConstructionIcon,
  FileUpIcon,
  KeyRoundIcon,
  Loader2Icon,
  type LucideIcon,
  PaletteIcon,
  RotateCcwIcon,
  SettingsIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AnnouncementBar } from '@/components/announcement-bar';
import { ConfirmDialog } from '@/components/form-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/admin-format';
import type { AdminSettings, SystemSettings } from '@/lib/api-types';
import { ClientApiError, clientApi, jsonBody } from '@/lib/client-api';
import { isHexColor, THEME_IDS, THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';

type Section = keyof SystemSettings;

const SECTIONS: { id: Section; label: string; icon: LucideIcon; description: string }[] = [
  { id: 'general', label: 'Chung', icon: SettingsIcon, description: 'Tên hệ thống hiển thị ở đầu trang, tiêu đề tab và email đăng nhập.' },
  { id: 'auth', label: 'Đăng nhập & đăng ký', icon: KeyRoundIcon, description: 'Ai được tự tạo tài khoản và bằng cách nào.' },
  { id: 'appearance', label: 'Giao diện', icon: PaletteIcon, description: 'Theme mặc định cho toàn hệ thống. Khoá học và người dùng vẫn chọn được theme riêng.' },
  { id: 'content', label: 'Nội dung & tải lên', icon: FileUpIcon, description: 'Giới hạn ảnh và chức năng nhập từ Docusaurus/Mintlify.' },
  { id: 'learning', label: 'Học tập', icon: BookOpenCheckIcon, description: 'Khi nào một bài được tự tính là đã học xong.' },
  { id: 'announcement', label: 'Thông báo', icon: BellIcon, description: 'Dải thông báo hiện trên đầu mọi trang cho tất cả người dùng.' },
  { id: 'maintenance', label: 'Bảo trì', icon: ConstructionIcon, description: 'Tạm khoá hệ thống với mọi người trừ quản trị viên.' },
];

/** Trang cài đặt hệ thống: mỗi nhóm lưu riêng, có nút trả về mặc định. */
export function SettingsForm({ data }: { data: AdminSettings }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get('section');
  const section: Section = SECTIONS.some((s) => s.id === requested) ? (requested as Section) : 'general';
  const meta = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="grid gap-6 px-4 lg:grid-cols-[14rem_1fr] lg:px-6">
      <nav aria-label="Nhóm cài đặt" className="flex gap-1 overflow-x-auto lg:flex-col">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => router.replace(`${pathname}?section=${s.id}`, { scroll: false })}
            aria-current={s.id === section ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              s.id === section && 'bg-muted font-medium text-foreground',
            )}
          >
            <s.icon className="size-4" />
            {s.label}
            {s.id === 'maintenance' && data.settings.maintenance.enabled ? (
              <span className="ml-auto size-2 rounded-full bg-destructive" aria-label="Đang bật" />
            ) : null}
            {s.id === 'announcement' && data.settings.announcement.enabled ? (
              <span className="ml-auto size-2 rounded-full bg-primary" aria-label="Đang bật" />
            ) : null}
          </button>
        ))}
        {data.updatedAt ? (
          <p className="mt-2 hidden px-3 text-xs text-muted-foreground lg:block">Sửa lần cuối {formatDate(data.updatedAt, true)}</p>
        ) : null}
      </nav>
      <SectionForm key={section} section={section} title={meta.label} description={meta.description} data={data} />
    </div>
  );
}

function SectionForm<S extends Section>({
  section,
  title,
  description,
  data,
}: {
  section: S;
  title: string;
  description: string;
  data: AdminSettings;
}) {
  const router = useRouter();
  const saved = data.settings[section];
  const [value, setValue] = useState<SystemSettings[S]>(saved);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setValue(data.settings[section]), [data, section]);

  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  const isDefault = JSON.stringify(value) === JSON.stringify(data.defaults[section]);
  const set = <K extends keyof SystemSettings[S]>(key: K, v: SystemSettings[S][K]) => setValue((prev) => ({ ...prev, [key]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await clientApi('/admin/settings', { method: 'PATCH', ...jsonBody({ [section]: value }) });
      toast.success(`Đã lưu: ${title}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Không lưu được, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  };

  // Bật bảo trì khoá cả hệ thống: hỏi lại trước khi lưu.
  const turningOnMaintenance =
    section === 'maintenance' && (value as SystemSettings['maintenance']).enabled && !(saved as SystemSettings['maintenance']).enabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid max-w-2xl gap-6">
        {renderFields(section, value as never, set as never)}
      </CardContent>
      <CardFooter className="justify-between gap-2 border-t">
        <Button variant="ghost" size="sm" disabled={isDefault || busy} onClick={() => setValue(data.defaults[section])}>
          <RotateCcwIcon /> Về mặc định
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!dirty || busy} onClick={() => setValue(saved)}>
            Huỷ thay đổi
          </Button>
          <Button disabled={!dirty || busy} onClick={() => (turningOnMaintenance ? setConfirm(true) : void save())}>
            {busy ? <Loader2Icon className="animate-spin" /> : null} Lưu
          </Button>
        </div>
      </CardFooter>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Bật chế độ bảo trì?"
        description="Mọi người trừ quản trị viên sẽ không dùng được hệ thống (kể cả học viên đang đọc bài) cho tới khi tắt."
        confirmLabel="Bật bảo trì"
        destructive
        onConfirm={save}
      />
    </Card>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SwitchField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  );
}

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          aria-hidden
          tabIndex={-1}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-48 accent-[var(--primary)]"
        />
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </Field>
  );
}

type Setter<T> = <K extends keyof T>(key: K, value: T[K]) => void;

function renderFields(section: Section, value: never, set: never) {
  switch (section) {
    case 'general':
      return <GeneralFields value={value} set={set} />;
    case 'auth':
      return <AuthFields value={value} set={set} />;
    case 'appearance':
      return <AppearanceFields value={value} set={set} />;
    case 'content':
      return <ContentFields value={value} set={set} />;
    case 'learning':
      return <LearningFields value={value} set={set} />;
    case 'announcement':
      return <AnnouncementFields value={value} set={set} />;
    case 'maintenance':
      return <MaintenanceFields value={value} set={set} />;
  }
}

function GeneralFields({ value, set }: { value: SystemSettings['general']; set: Setter<SystemSettings['general']> }) {
  return (
    <>
      <Field label="Tên hệ thống" htmlFor="siteName" hint="Hiện ở thanh trên cùng, trang đăng nhập và tiêu đề tab trình duyệt.">
        <Input id="siteName" maxLength={60} value={value.siteName} onChange={(e) => set('siteName', e.target.value)} />
      </Field>
      <Field label="Khẩu hiệu" htmlFor="tagline" hint="Một dòng dưới tên ở trang đăng nhập; cũng là mô tả trang.">
        <Input id="tagline" maxLength={160} value={value.tagline} onChange={(e) => set('tagline', e.target.value)} />
      </Field>
      <Field label="Email hỗ trợ" htmlFor="supportEmail" hint="Hiện ở trang bảo trì và khi tắt đăng ký. Bỏ trống để ẩn.">
        <Input
          id="supportEmail"
          type="email"
          value={value.supportEmail ?? ''}
          onChange={(e) => set('supportEmail', e.target.value.trim() || null)}
          placeholder="hotro@truong.edu.vn"
        />
      </Field>
    </>
  );
}

function AuthFields({ value, set }: { value: SystemSettings['auth']; set: Setter<SystemSettings['auth']> }) {
  const [domains, setDomains] = useState(value.allowedEmailDomains.join('\n'));
  useEffect(() => setDomains(value.allowedEmailDomains.join('\n')), [value.allowedEmailDomains]);
  return (
    <>
      <SwitchField
        id="allowSignup"
        label="Cho phép tự đăng ký"
        hint="Tắt thì chỉ người đã có tài khoản đăng nhập được; trang Đăng ký báo liên hệ quản trị viên."
        checked={value.allowSignup}
        onChange={(v) => set('allowSignup', v)}
      />
      <SwitchField
        id="googleLogin"
        label="Đăng nhập bằng Google"
        hint="Cần cấu hình GOOGLE_CLIENT_ID trên API. Tắt thì tài khoản Google vẫn đăng nhập được bằng mật khẩu nếu đã đặt."
        checked={value.googleLogin}
        onChange={(v) => set('googleLogin', v)}
      />
      <Field
        label="Chỉ cho email thuộc tên miền"
        htmlFor="domains"
        hint="Mỗi dòng một tên miền, ví dụ softech.vn. Bỏ trống = mọi email. Áp cho cả đăng ký bằng Google."
      >
        <Textarea
          id="domains"
          rows={3}
          value={domains}
          onChange={(e) => {
            setDomains(e.target.value);
            set(
              'allowedEmailDomains',
              e.target.value
                .split(/[\s,;]+/)
                .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
                .filter(Boolean),
            );
          }}
          placeholder={'softech.vn\nstudent.softech.vn'}
          className="font-mono"
        />
      </Field>
      <Field label="Vai trò khi tự đăng ký" htmlFor="defaultRole" hint="Giảng viên được tạo khoá học ngay sau khi đăng ký.">
        <NativeSelect
          id="defaultRole"
          value={value.defaultSystemRole}
          onChange={(e) => set('defaultSystemRole', e.target.value as SystemSettings['auth']['defaultSystemRole'])}
          className="w-56"
        >
          <option value="USER">Học viên</option>
          <option value="INSTRUCTOR">Giảng viên</option>
        </NativeSelect>
      </Field>
    </>
  );
}

function AppearanceFields({ value, set }: { value: SystemSettings['appearance']; set: Setter<SystemSettings['appearance']> }) {
  const custom = value.defaultPrimaryColor !== null;
  return (
    <>
      <Field label="Theme mặc định" hint="Áp cho trang chủ, khu quản trị và các khoá học chọn “Theo mặc định hệ thống”.">
        <div role="radiogroup" aria-label="Theme mặc định" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEME_IDS.map((id) => {
            const def = THEMES[id];
            const selected = value.defaultTheme === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set('defaultTheme', id)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-foreground/30',
                  selected && 'border-primary ring-1 ring-primary',
                )}
              >
                <span
                  aria-hidden
                  className="size-4 shrink-0 rounded-full border"
                  style={{ background: `linear-gradient(135deg, ${def.light.primary} 50%, ${def.dark.primary} 50%)` }}
                />
                <span style={{ fontFamily: `var(${def.font})` }}>{def.name}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <SwitchField
        id="customPrimary"
        label="Màu chính riêng"
        hint="Đè màu chính của theme mặc định. Độ sáng được tự chỉnh để đủ tương phản."
        checked={custom}
        onChange={(v) => set('defaultPrimaryColor', v ? '#2563eb' : null)}
      />
      {custom ? (
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Chọn màu chính"
            value={value.defaultPrimaryColor ?? '#2563eb'}
            onChange={(e) => set('defaultPrimaryColor', e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
          />
          <Input
            aria-label="Mã màu"
            value={value.defaultPrimaryColor ?? ''}
            maxLength={7}
            onChange={(e) => set('defaultPrimaryColor', e.target.value.trim())}
            className="w-32 font-mono"
            aria-invalid={!isHexColor(value.defaultPrimaryColor)}
          />
        </div>
      ) : null}
    </>
  );
}

function ContentFields({ value, set }: { value: SystemSettings['content']; set: Setter<SystemSettings['content']> }) {
  return (
    <>
      <NumberField
        id="maxImageMb"
        label="Dung lượng ảnh tối đa"
        hint="Áp cho ảnh dán/kéo-thả vào editor và ảnh trong gói nhập. Trần của hệ thống là 10 MB."
        value={value.maxImageMb}
        min={1}
        max={10}
        suffix="MB"
        onChange={(v) => set('maxImageMb', v)}
      />
      <SwitchField
        id="importEnabled"
        label="Cho phép nhập từ Docusaurus/Mintlify"
        hint="Tắt thì nút Nhập trong Studio báo chức năng đang tắt."
        checked={value.importEnabled}
        onChange={(v) => set('importEnabled', v)}
      />
      <NumberField
        id="importMaxDocs"
        label="Số bài tối đa mỗi lần nhập"
        value={value.importMaxDocs}
        min={1}
        max={1000}
        suffix="bài"
        onChange={(v) => set('importMaxDocs', v)}
      />
    </>
  );
}

function LearningFields({ value, set }: { value: SystemSettings['learning']; set: Setter<SystemSettings['learning']> }) {
  return (
    <>
      <NumberField
        id="scrollPct"
        label="Cuộn tới ít nhất"
        hint="Phần trăm chiều dài bài học viên đã cuộn qua."
        value={value.autoCompleteScrollPct}
        min={50}
        max={100}
        suffix="% bài"
        onChange={(v) => set('autoCompleteScrollPct', v)}
      />
      <NumberField
        id="seconds"
        label="Và đọc ít nhất"
        hint="Chỉ tính thời gian tab đang mở. 0 = chỉ cần cuộn đủ."
        value={value.autoCompleteSeconds}
        min={0}
        max={600}
        suffix="giây"
        onChange={(v) => set('autoCompleteSeconds', v)}
      />
      <p className="text-sm text-muted-foreground">
        Học viên vẫn bấm được “Đánh dấu hoàn thành”. Đổi ngưỡng không tính lại các bài đã hoàn thành trước đó.
      </p>
    </>
  );
}

function AnnouncementFields({ value, set }: { value: SystemSettings['announcement']; set: Setter<SystemSettings['announcement']> }) {
  return (
    <>
      <SwitchField id="annEnabled" label="Hiện thông báo" checked={value.enabled} onChange={(v) => set('enabled', v)} />
      <Field label="Nội dung" htmlFor="annMessage" hint={`${value.message.length}/300 ký tự. Người dùng có thể ẩn; đổi nội dung thì hiện lại.`}>
        <Textarea id="annMessage" rows={2} maxLength={300} value={value.message} onChange={(e) => set('message', e.target.value)} />
      </Field>
      <Field label="Mức độ" htmlFor="annTone">
        <NativeSelect
          id="annTone"
          value={value.tone}
          onChange={(e) => set('tone', e.target.value as SystemSettings['announcement']['tone'])}
          className="w-56"
        >
          <option value="info">Thông tin</option>
          <option value="warning">Cảnh báo</option>
          <option value="danger">Khẩn cấp</option>
        </NativeSelect>
      </Field>
      {value.message.trim() ? (
        <div className="grid gap-2">
          <span className="text-sm font-medium">Xem trước</span>
          <div className="overflow-hidden rounded-lg border">
            <AnnouncementBar key={`${value.message}-${value.tone}`} message={value.message} tone={value.tone} preview />
          </div>
        </div>
      ) : null}
    </>
  );
}

function MaintenanceFields({ value, set }: { value: SystemSettings['maintenance']; set: Setter<SystemSettings['maintenance']> }) {
  return (
    <>
      <Alert variant={value.enabled ? 'destructive' : 'default'}>
        <TriangleAlertIcon />
        <AlertTitle>{value.enabled ? 'Hệ thống đang bảo trì' : 'Hệ thống đang hoạt động bình thường'}</AlertTitle>
        <AlertDescription>
          Khi bật, mọi người trừ quản trị viên thấy trang bảo trì; API trả lỗi 503. Quản trị viên vẫn đăng nhập và làm việc
          bình thường.
        </AlertDescription>
      </Alert>
      <SwitchField id="mtEnabled" label="Bật chế độ bảo trì" checked={value.enabled} onChange={(v) => set('enabled', v)} />
      <Field label="Thông điệp" htmlFor="mtMessage" hint="Hiện trên trang bảo trì.">
        <Textarea id="mtMessage" rows={2} maxLength={300} value={value.message} onChange={(e) => set('message', e.target.value)} />
      </Field>
    </>
  );
}
