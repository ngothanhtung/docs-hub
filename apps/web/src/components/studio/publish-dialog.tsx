'use client';

import { Loader2Icon, SendIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Xuất bản: ghi chú cho lần xuất bản và hẹn giờ mở bài (tuỳ chọn). */
export function PublishDialog({
  open,
  onOpenChange,
  warningCount,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warningCount: number;
  onPublish: (input: { message?: string; publishAt?: string }) => Promise<boolean>;
}) {
  const [schedule, setSchedule] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const at = String(form.get('publishAt') ?? '');
    setPending(true);
    const ok = await onPublish({
      message: String(form.get('message') ?? '').trim() || undefined,
      publishAt: schedule && at ? new Date(at).toISOString() : undefined,
    });
    setPending(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Xuất bản bài viết</DialogTitle>
            <DialogDescription>
              Học viên sẽ thấy đúng nội dung đang có trong editor.
              {warningCount > 0 ? ` Bài còn ${warningCount} cảnh báo, bạn vẫn có thể xuất bản.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="message">Ghi chú thay đổi (không bắt buộc)</Label>
            <Input id="message" name="message" maxLength={200} placeholder="Ví dụ: Bổ sung ví dụ về scope" />
          </div>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox checked={schedule} onCheckedChange={(checked) => setSchedule(checked === true)} />
            Hẹn giờ mở bài cho học viên
          </Label>
          {schedule ? (
            <Input
              type="datetime-local"
              name="publishAt"
              required
              aria-label="Thời điểm mở bài"
              min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
            />
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              {schedule ? 'Hẹn giờ xuất bản' : 'Xuất bản ngay'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
