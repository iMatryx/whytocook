import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { clientEnv } from "@/config/env/client";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Cookly — idei pentru mesele tale", template: "%s | Cookly" },
  description: "Un loc pentru ideile tale de gătit. Cookly se pregătește pentru tine.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  void clientEnv;

  return (
    <html lang="ro" suppressHydrationWarning>
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <a href="#main-content" className="sr-only z-50 rounded-md bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4">Sari la conținut</a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="cookly-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
