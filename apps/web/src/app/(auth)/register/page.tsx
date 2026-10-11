import { LockIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPublicSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Đăng ký' };

export default async function RegisterPage() {
  const { allowSignup, allowedEmailDomains, supportEmail } = await getPublicSettings();
  if (!allowSignup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <LockIcon className="size-5" /> Đăng ký đang tắt
          </CardTitle>
          <CardDescription>
            Tài khoản do quản trị viên cấp.
            {supportEmail ? ` Liên hệ ${supportEmail} để được tạo tài khoản.` : ' Hãy liên hệ giảng viên hoặc quản trị viên.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
            Về trang đăng nhập
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Tạo tài khoản</CardTitle>
        <CardDescription>
          Sau khi đăng ký, giảng viên sẽ ghi danh bạn vào khoá học bằng email này.
          {allowedEmailDomains.length
            ? ` Chỉ nhận email ${allowedEmailDomains.map((d) => `@${d}`).join(', ')}.`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="register" />
      </CardContent>
    </Card>
  );
}
