import { FileQuestionIcon } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <FileQuestionIcon className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Không tìm thấy trang</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Trang không tồn tại, chưa được xuất bản, hoặc bạn chưa được ghi danh vào khoá học này.
      </p>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        Về khoá học của tôi
      </Link>
    </main>
  );
}
