'use client';

import { MenuIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SidebarNav, type SidebarNavProps } from './sidebar-nav';

/** Sidebar dạng ngăn kéo cho màn hình dưới 1024px. */
export function MobileNav({ courseTitle, ...nav }: SidebarNavProps & { courseTitle: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở mục lục" />}
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{courseTitle}</SheetTitle>
        </SheetHeader>
        <div className="px-3 pb-6">
          <SidebarNav {...nav} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
