'use client';

import { ChevronDownIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { VersionSummary } from '@/lib/api-types';

export function StudioVersionSwitcher({
  courseSlug,
  current,
  versions,
}: {
  courseSlug: string;
  current: string;
  versions: VersionSummary[];
}) {
  const router = useRouter();
  const active = versions.find((v) => v.slug === current);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" aria-label="Chọn phiên bản" />}>
        {active?.label ?? current}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(slug) => router.push(`/studio/${courseSlug}/${String(slug)}`)}
        >
          {versions.map((v) => (
            <DropdownMenuRadioItem key={v.id} value={v.slug}>
              {v.label}
              {v.isCurrent ? <span className="ml-auto text-xs text-muted-foreground">hiện hành</span> : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
