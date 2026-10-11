import { ConstructionIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { getPublicSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Đang bảo trì' };

/** Trang hiện khi admin bật chế độ bảo trì (API trả 503 cho người không phải admin). */
export default async function MaintenancePage() {
  const { siteName, maintenance, supportEmail } = await getPublicSettings();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <ConstructionIcon className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">{maintenance ? `${siteName} đang bảo trì` : `${siteName} đã hoạt động trở lại`}</h1>
      <p className="max-w-md text-muted-foreground">
        {maintenance
          ? maintenance.message || 'Hệ thống đang được nâng cấp, vui lòng quay lại sau ít phút.'
          : 'Bảo trì đã xong, bạn có thể tiếp tục học.'}
      </p>
      {supportEmail ? (
        <p className="text-sm text-muted-foreground">
          Cần hỗ trợ: <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
      ) : null}
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        {maintenance ? 'Thử lại' : 'Về trang chủ'}
      </Link>
    </main>
  );
}
