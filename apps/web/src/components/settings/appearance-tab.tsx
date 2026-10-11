'use client';

import { CheckIcon, Loader2Icon, PaletteIcon } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CourseDetail } from '@/lib/api-types';
import { clientApi, jsonBody } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { isHexColor, isThemeId, previewVars, THEME_IDS, THEMES, type ThemeId } from '@/lib/themes';
import { useAction } from './use-action';

const DEFAULT_CUSTOM_COLOR = '#2563eb';

/**
 * Theme của khoá học (giống `theme` + `colors.primary` trong docs.json của Mintlify).
 * Học viên đã tự chọn theme riêng trong menu giao diện vẫn thấy theme của họ.
 */
export function AppearanceTab({ course }: { course: CourseDetail }) {
  const { run, pending } = useAction();
  // 'system' = theo theme mặc định admin đặt cho toàn hệ thống (lưu null).
  const [theme, setTheme] = useState<ThemeId | 'system'>(isThemeId(course.theme) ? course.theme : 'system');
  const previewTheme: ThemeId = theme === 'system' ? 'docshub' : theme;
  const [useCustom, setUseCustom] = useState(isHexColor(course.primaryColor));
  const [color, setColor] = useState(isHexColor(course.primaryColor) ? course.primaryColor : DEFAULT_CUSTOM_COLOR);
  const [colorText, setColorText] = useState(color);

  const customColor = useCustom && isHexColor(color) ? color : null;
  const dirty =
    theme !== (isThemeId(course.theme) ? course.theme : 'system') ||
    customColor !== (isHexColor(course.primaryColor) ? course.primaryColor.toLowerCase() : null);

  const save = () =>
    run(
      'appearance',
      () =>
        clientApi(`/courses/${course.id}`, {
          method: 'PATCH',
          ...jsonBody({ theme: theme === 'system' ? null : theme, primaryColor: customColor }),
        }),
      'Đã lưu giao diện khoá học',
    );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Đổi màu, font và độ bo góc của trang đọc và Studio của khoá này. Học viên vẫn đổi được sáng/tối, và có
            thể tự chọn theme riêng trong menu giao diện.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Theme của khoá học" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'system'}
              onClick={() => setTheme('system')}
              className={cn(
                'flex flex-col justify-center gap-1 rounded-lg border border-dashed p-4 text-left transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                theme === 'system' && 'border-solid border-primary ring-1 ring-primary',
              )}
            >
              <span className="flex items-center gap-1.5 font-medium">
                Theo mặc định hệ thống
                {theme === 'system' ? <CheckIcon className="size-4 text-primary" /> : null}
              </span>
              <span className="text-xs text-muted-foreground">
                Dùng theme quản trị viên đặt cho toàn hệ thống; đổi theo khi admin đổi.
              </span>
            </button>
            {THEME_IDS.map((id) => (
              <ThemeCard key={id} id={id} selected={theme === id} onSelect={() => setTheme(id)} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PaletteIcon className="size-4" /> Màu chính
          </CardTitle>
          <CardDescription>
            Đè màu chính của theme bằng màu thương hiệu. Độ sáng được tự chỉnh để chữ và nút luôn đủ tương phản ở cả
            chế độ sáng và tối.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox checked={useCustom} onCheckedChange={(checked) => setUseCustom(checked === true)} />
            Dùng màu chính riêng
          </Label>
          <div className={cn('flex items-center gap-3', !useCustom && 'pointer-events-none opacity-50')}>
            <input
              type="color"
              aria-label="Chọn màu chính"
              value={color}
              disabled={!useCustom}
              onChange={(e) => {
                setColor(e.target.value);
                setColorText(e.target.value);
              }}
              className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
            />
            <Input
              aria-label="Mã màu (#rrggbb)"
              value={colorText}
              disabled={!useCustom}
              maxLength={7}
              className="w-32 font-mono"
              aria-invalid={!isHexColor(colorText)}
              onChange={(e) => {
                const value = e.target.value.trim();
                setColorText(value);
                if (isHexColor(value)) setColor(value.toLowerCase());
              }}
            />
            {!isHexColor(colorText) ? <span className="text-xs text-destructive">Nhập dạng #rrggbb</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Xem trước</CardTitle>
          <CardDescription>
            {theme === 'system' ? 'Theo mặc định hệ thống (xem trước bằng DocsHub)' : `${THEMES[theme].name} · font ${THEMES[theme].fontLabel}`}
            {customColor ? ` · màu ${customColor}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Preview theme={previewTheme} mode="light" color={customColor} />
          <Preview theme={previewTheme} mode="dark" color={customColor} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || pending !== null || (useCustom && !isHexColor(colorText))}>
          {pending === 'appearance' ? <Loader2Icon className="animate-spin" /> : null}
          Lưu giao diện
        </Button>
      </div>
    </div>
  );
}

function ThemeCard({ id, selected, onSelect }: { id: ThemeId; selected: boolean; onSelect: () => void }) {
  const def = THEMES[id];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-lg border text-left transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        selected && 'border-primary ring-1 ring-primary',
      )}
    >
      <div
        className="flex items-center gap-2 border-b bg-background px-3 py-3 text-foreground"
        style={previewVars(id, 'light') as CSSProperties}
      >
        <span className="h-6 rounded-[calc(var(--radius)*0.8)] bg-primary px-2 text-xs leading-6 font-medium text-primary-foreground">
          Nút
        </span>
        <span className="text-sm font-medium text-primary underline underline-offset-2" style={{ fontFamily: `var(${def.font})` }}>
          Liên kết
        </span>
        <span
          aria-hidden
          className="ml-auto size-4 rounded-full border"
          style={{ background: (previewVars(id, 'dark') as Record<string, string>)['--primary'] }}
        />
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2.5">
        <span className="flex items-center gap-1.5 font-medium" style={{ fontFamily: `var(${def.headingFont})` }}>
          {def.name}
          {selected ? <CheckIcon className="size-4 text-primary" /> : null}
        </span>
        <span className="text-xs text-muted-foreground">{def.description}</span>
        <span className="text-xs text-muted-foreground">Font: {def.fontLabel}</span>
      </div>
    </button>
  );
}

/** Một khung trang đọc thu nhỏ với biến CSS của theme đang chọn. */
function Preview({ theme, mode, color }: { theme: ThemeId; mode: 'light' | 'dark'; color: string | null }) {
  return (
    <div
      className="overflow-hidden rounded-lg border bg-background font-sans text-foreground"
      style={{ ...(previewVars(theme, mode, color) as CSSProperties), colorScheme: mode }}
    >
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
        <span className="font-semibold">DocsHub</span>
        <span className="text-muted-foreground">{mode === 'light' ? 'Sáng' : 'Tối'}</span>
      </div>
      <div className="grid grid-cols-[7rem_1fr] text-sm">
        <div className="flex flex-col gap-1 border-r p-2 text-xs">
          <span className="rounded-[calc(var(--radius)*0.8)] px-2 py-1 text-muted-foreground">Giới thiệu</span>
          <span className="rounded-[calc(var(--radius)*0.8)] bg-primary/10 px-2 py-1 font-medium text-primary">Cài đặt</span>
          <span className="rounded-[calc(var(--radius)*0.8)] px-2 py-1 text-muted-foreground">Module</span>
        </div>
        <div className="flex flex-col gap-2 p-3">
          <span className="text-base font-semibold" style={{ fontFamily: 'var(--theme-font-heading)' }}>
            Cài đặt dự án
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Tạo dự án mới bằng Nest CLI, xem <span className="text-primary underline">hướng dẫn chi tiết</span>.
          </span>
          <span className="rounded-[var(--radius)] border bg-muted px-2 py-1.5 font-mono text-[11px]">pnpm add @nestjs/cli</span>
          <span className="w-fit rounded-[calc(var(--radius)*0.8)] bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            Đánh dấu hoàn thành
          </span>
        </div>
      </div>
    </div>
  );
}
