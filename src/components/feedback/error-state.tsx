"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/shared/presentation/cn";

export type ErrorStateProps = {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  announce?: boolean;
  className?: string;
};

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Reîncearcă",
  announce = true,
  className,
}: ErrorStateProps) {
  const id = useId();
  return (
    <section
      role={announce ? "alert" : undefined}
      aria-labelledby={id}
      className={cn(
        "rounded-xl border border-danger-foreground/30 bg-danger p-6 text-danger-foreground",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon name="alert" className="mt-0.5 shrink-0" />
        <div>
          <h3 id={id} className="font-semibold">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
      {onRetry && (
        <Button className="mt-5" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </section>
  );
}
