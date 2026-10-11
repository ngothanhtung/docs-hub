'use client';

import { Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type AuthFormState, login, register } from '@/lib/auth-actions';

export function AuthForm({
  mode,
  next,
  allowSignup = true,
}: {
  mode: 'login' | 'register';
  next?: string;
  /** Admin tắt tự đăng ký thì ẩn link "Đăng ký". */
  allowSignup?: boolean;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === 'login' ? login : register,
    {},
  );
  const isRegister = mode === 'register';

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ''} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {isRegister ? (
        <div className="grid gap-2">
          <Label htmlFor="name">Họ tên</Label>
          <Input
            key={`name-${state.values?.name ?? ''}`}
            id="name"
            name="name"
            autoComplete="name"
            required
            defaultValue={state.values?.name}
          />
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        {/* key: dựng lại input khi giá trị giữ lại đổi, vì Base UI không cho đổi defaultValue. */}
        <Input
          key={`email-${state.values?.email ?? ''}`}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          minLength={isRegister ? 8 : undefined}
          required
        />
        {isRegister ? (
          <p className="text-xs text-muted-foreground">Ít nhất 8 ký tự.</p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
      </Button>
      {isRegister || allowSignup ? (
      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isRegister ? 'Đăng nhập' : 'Đăng ký'}
        </Link>
      </p>
      ) : null}
    </form>
  );
}
