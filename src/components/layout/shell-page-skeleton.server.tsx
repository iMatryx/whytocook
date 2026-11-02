import "server-only";

import { Skeleton } from "@/components/ui/skeleton";

export function ShellPageSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă pagina" className="space-y-5">
      <span className="sr-only">Se încarcă pagina…</span>
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-12 w-3/4 max-w-lg" />
      <Skeleton className="h-5 w-4/5 max-w-xl" />
      <Skeleton className="mt-10 h-64 w-full rounded-2xl" />
    </div>
  );
}
