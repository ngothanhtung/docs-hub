import { FileTextIcon } from 'lucide-react';
import type { CourseRole } from '@/lib/api-types';

export function EmptyCourse({ role }: { role: CourseRole }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
      <FileTextIcon className="size-10 text-muted-foreground" />
      <p className="font-medium">Phiên bản này chưa có bài viết nào được xuất bản</p>
      <p className="text-sm text-muted-foreground">
        {role === 'LEARNER'
          ? 'Giảng viên sẽ mở bài theo lịch học. Hãy quay lại sau.'
          : 'Bài viết chỉ hiện ở đây sau khi được xuất bản. Studio soạn bài sẽ có ở bản tiếp theo.'}
      </p>
    </div>
  );
}
