import type { Metadata } from 'next';
import {
  Geist,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  JetBrains_Mono,
  Lexend,
  Lora,
  Manrope,
  Nunito,
  Plus_Jakarta_Sans,
} from 'next/font/google';
import { cookies } from 'next/headers';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { THEME_COOKIE } from '@/lib/session';
import { getPublicSettings } from '@/lib/settings';
import { isThemeId, systemThemeCss, userThemesCss } from '@/lib/themes';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin', 'vietnamese'] });
const mono = JetBrains_Mono({ variable: '--font-code', subsets: ['latin', 'vietnamese'] });
// Font của các theme: chỉ tải khi trang dùng tới (preload: false), không làm chậm theme mặc định.
// next/font yêu cầu mỗi font là một const ở cấp module.
const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin', 'vietnamese'], preload: false });
const plexSans = IBM_Plex_Sans({ variable: '--font-plex-sans', subsets: ['latin', 'vietnamese'], preload: false });
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  preload: false,
});
const geist = Geist({ variable: '--font-geist', subsets: ['latin', 'vietnamese'], preload: false });
const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin', 'vietnamese'], preload: false });
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin', 'vietnamese'], preload: false });
const lora = Lora({ variable: '--font-lora', subsets: ['latin', 'vietnamese'], preload: false });
const lexend = Lexend({ variable: '--font-lexend', subsets: ['latin', 'vietnamese'], preload: false });
const themeFonts = [jakarta, plexSans, plexMono, geist, nunito, manrope, lora, lexend];

/** CSS của các theme người dùng tự chọn; giống nhau mọi trang nên tạo một lần. */
const USER_THEMES_CSS = userThemesCss();

export async function generateMetadata(): Promise<Metadata> {
  const { siteName, tagline } = await getPublicSettings();
  return {
    title: { default: siteName, template: `%s · ${siteName}` },
    description: tagline,
    // Toàn bộ nội dung yêu cầu đăng nhập, không cần lập chỉ mục.
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Theme người dùng tự chọn (lưu trong tài khoản, chép ra cookie khi đăng nhập/đổi theme).
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const settings = await getPublicSettings();
  // Theme mặc định do admin chọn; theme khoá học và theme người dùng tự chọn đều đè được.
  const systemCss = systemThemeCss(settings.defaultTheme, settings.defaultPrimaryColor);
  const fontClasses = [inter, mono, ...themeFonts].map((font) => font.variable).join(' ');

  return (
    <html
      lang="vi"
      suppressHydrationWarning
      data-theme={isThemeId(theme) ? theme : undefined}
      className={`${fontClasses} h-full antialiased`}
    >
      <head>
        {systemCss ? <style id="docshub-system-theme" dangerouslySetInnerHTML={{ __html: systemCss }} /> : null}
        <style id="docshub-user-themes" dangerouslySetInnerHTML={{ __html: USER_THEMES_CSS }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
