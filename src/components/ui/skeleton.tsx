import type { ComponentProps } from "react";

import { cn } from "@/shared/presentation/cn";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)} {...props} />;
}
