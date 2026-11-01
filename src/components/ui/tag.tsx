"use client";

import type { ComponentProps } from "react";

import { cn } from "@/shared/presentation/cn";

import { Badge } from "./badge";

export function Tag(props: ComponentProps<typeof Badge>) {
  return <Badge {...props} />;
}

export function Chip({ label, onRemove, removeLabel, className }: { label: string; onRemove?: () => void; removeLabel?: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-h-10 items-center gap-1 rounded-full bg-secondary pl-3 text-sm font-medium text-secondary-foreground", !onRemove && "pr-3", className)}>
      {label}
      {onRemove && <button type="button" aria-label={removeLabel ?? `Elimină ${label}`} onClick={onRemove} className="inline-flex size-10 items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"><span aria-hidden="true">×</span></button>}
    </span>
  );
}
