'use client';

import { Loader2Icon, PlusIcon } from 'lucide-react';
import { useActionState } from 'react';
import { createCourse, type CreateCourseState } from '@/app/(home)/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function CreateCourseDialog() {
  const [state, action, pending] = useActionState<CreateCourseState, FormData>(createCourse, {});

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <PlusIcon /> Tạo khoá học
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Tạo khoá học</DialogTitle>
            <DialogDescription>
              Khoá học mới có sẵn một phiên bản. Bạn là chủ khoá và có thể mời biên tập viên sau.
            </DialogDescription>
          </DialogHeader>
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="title">Tên khoá học</Label>
            <Input id="title" name="title" placeholder="Lập trình NestJS cơ bản" required maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea id="description" name="description" rows={3} maxLength={2000} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="versionLabel">Phiên bản đầu tiên</Label>
            <Input
              id="versionLabel"
              name="versionLabel"
              placeholder={String(new Date().getFullYear())}
              maxLength={50}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Tạo khoá học
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
