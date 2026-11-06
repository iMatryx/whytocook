"use client";

import { useId, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/shared/presentation/cn";

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: IconName;
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon = "leaf",
  compact = false,
  className,
}: EmptyStateProps) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <span className="mb-5 rounded-full bg-accent p-4 text-accent-foreground">
        <Icon name={icon} className="size-7" />
      </span>
      <h3 id={id} className="text-lg font-semibold">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}
