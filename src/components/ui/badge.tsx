import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/presentation/cn";

const badgeVariants = cva("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-5 font-medium", {
  variants: { tone: {
    neutral: "bg-muted text-muted-foreground",
    accent: "bg-accent text-accent-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    danger: "bg-danger text-danger-foreground",
    info: "bg-info text-info-foreground",
  } },
  defaultVariants: { tone: "neutral" },
});

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;
export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone, className }))} {...props} />;
}

export { badgeVariants };
