"use client";

import type { ComponentProps, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/shared/presentation/cn";

import { Icon } from "./icon";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export type DialogContentProps = Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  title: string;
  description: string;
  footer?: ReactNode;
  presentation?: "modal" | "drawer";
};

export function DialogContent({ title, description, children, footer, className, presentation = "modal", ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col border border-border bg-card text-card-foreground shadow-xl outline-none",
          presentation === "modal"
            ? "top-1/2 left-1/2 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl"
            : "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-none sm:w-[26rem] sm:max-w-full sm:rounded-none",
          className,
        )}
        {...props}
      >
        <header className="shrink-0 px-6 pt-6 pb-5 pr-16">
          <DialogPrimitive.Title className="font-display text-2xl leading-tight">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</DialogPrimitive.Description>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-border px-6 py-4">{footer}</footer>}
        <DialogPrimitive.Close aria-label="Închide" className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><Icon name="close" /></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
