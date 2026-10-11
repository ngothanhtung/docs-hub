'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <TriangleAlertIcon className="size-10 text-destructive" />
      <h1 className="text-xl font-semibold">Đã có lỗi xảy ra</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Không tải được trang. Kiểm tra kết nối hoặc thử lại sau ít phút.
      </p>
      <Button variant="outline" onClick={reset}>
        Thử lại
      </Button>
    </main>
  );
}
