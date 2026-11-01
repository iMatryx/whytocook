"use client";

import type { ComponentProps, CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

export function Toaster(props: ComponentProps<typeof Sonner>) {
  const { resolvedTheme } = useTheme();
  return <Sonner richColors theme={resolvedTheme === "dark" ? "dark" : "light"} position="bottom-right" closeButton duration={6000} containerAriaLabel="Notificări" toastOptions={{ closeButtonAriaLabel: "Închide notificarea", classNames: { toast: "font-sans", description: "text-muted-foreground" } }} style={{ "--normal-bg": "var(--card)", "--normal-text": "var(--card-foreground)", "--normal-border": "var(--border)", "--success-bg": "var(--success)", "--success-text": "var(--success-foreground)", "--success-border": "var(--border)", "--error-bg": "var(--danger)", "--error-text": "var(--danger-foreground)", "--error-border": "var(--border)" } as CSSProperties} {...props} />;
}

export { toast };
