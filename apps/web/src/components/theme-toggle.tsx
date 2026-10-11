'use client';

import { BookOpenIcon, MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClientApiError, clientApi, jsonBody } from '@/lib/client-api';
import { isThemeId, THEME_IDS, THEMES, type ThemeId } from '@/lib/themes';

const THEME_COOKIE = 'docshub_theme';
const FOLLOW_COURSE = 'course';

/** Đổi theme ngay trên trang đang mở; `null` = bỏ theme riêng, theo theme của khoá học. */
function applyColorTheme(theme: ThemeId | null) {
  const root = document.documentElement;
  if (theme) {
    root.dataset.theme = theme;
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`;
  } else {
    delete root.dataset.theme;
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
}

/** Sáng/tối và theme màu. Theme màu lưu vào tài khoản để dùng lại ở máy khác. */
export function ThemeToggle({ colorTheme: initial }: { colorTheme: string | null }) {
  const { theme, setTheme } = useTheme();
  const [colorTheme, setColorTheme] = useState<ThemeId | null>(isThemeId(initial) ? initial : null);

  // Đổi theme ở máy khác: cookie ở máy này còn giá trị cũ thì lấy theo tài khoản.
  useEffect(() => {
    const account = isThemeId(initial) ? initial : null;
    if ((document.documentElement.dataset.theme ?? null) !== account) applyColorTheme(account);
  }, [initial]);

  const chooseColorTheme = async (value: string) => {
    const next = isThemeId(value) ? value : null;
    const previous = colorTheme;
    setColorTheme(next);
    applyColorTheme(next);
    try {
      await clientApi('/users/me', { method: 'PATCH', ...jsonBody({ theme: next }) });
    } catch (error) {
      setColorTheme(previous);
      applyColorTheme(previous);
      toast.error(error instanceof ClientApiError ? error.message : 'Không lưu được theme, vui lòng thử lại');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Giao diện: sáng/tối và theme màu" />}>
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(36rem,var(--available-height))] w-60 overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Chế độ</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={(v) => setTheme(String(v))}>
            <DropdownMenuRadioItem value="light">
              <SunIcon /> Sáng
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <MoonIcon /> Tối
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <MonitorIcon /> Theo máy
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-1.5">
            <PaletteIcon className="size-3.5" /> Theme màu
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={colorTheme ?? FOLLOW_COURSE} onValueChange={(v) => void chooseColorTheme(String(v))}>
            <DropdownMenuRadioItem value={FOLLOW_COURSE}>
              <BookOpenIcon /> Theo khoá học
            </DropdownMenuRadioItem>
            {THEME_IDS.map((id) => {
              const def = THEMES[id];
              return (
                <DropdownMenuRadioItem key={id} value={id} title={def.description}>
                  <span
                    aria-hidden
                    className="size-3.5 shrink-0 rounded-full border"
                    style={{ background: `linear-gradient(135deg, ${def.light.primary} 50%, ${def.dark.primary} 50%)` }}
                  />
                  <span style={{ fontFamily: `var(${def.font})` }}>{def.name}</span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
