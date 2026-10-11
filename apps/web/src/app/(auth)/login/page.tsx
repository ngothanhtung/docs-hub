import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPublicSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const [{ next }, settings] = await Promise.all([searchParams, getPublicSettings()]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Đăng nhập</CardTitle>
        <CardDescription>Đăng nhập để đọc tài liệu khoá học của bạn.</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm
          mode="login"
          next={typeof next === 'string' ? next : undefined}
          allowSignup={settings.allowSignup}
        />
      </CardContent>
    </Card>
  );
}
