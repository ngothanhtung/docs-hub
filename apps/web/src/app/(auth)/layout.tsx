import { BookOpenTextIcon } from 'lucide-react';
import { getPublicSettings } from '@/lib/settings';

export default async function AuthLayout({ children }: LayoutProps<'/'>) {
  const { siteName, tagline } = await getPublicSettings();
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <BookOpenTextIcon className="size-6 text-primary" />
          {siteName}
        </div>
        {tagline ? <p className="-mt-4 mb-6 text-center text-sm text-muted-foreground">{tagline}</p> : null}
        {children}
      </div>
    </main>
  );
}
