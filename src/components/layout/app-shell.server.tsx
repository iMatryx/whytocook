import "server-only";

import type { ReactNode } from "react";

import { Breadcrumbs } from "./breadcrumbs";
import { ShellFooter } from "./shell-footer.server";
import { ShellHeader } from "./shell-header.server";
import { ShellSidebar } from "./shell-sidebar.server";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <ShellHeader />
      <div className="mx-auto grid w-full max-w-7xl flex-1 px-4 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <ShellSidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 py-8 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:py-10"
        >
          <Breadcrumbs />
          {children}
        </main>
      </div>
      <ShellFooter />
    </div>
  );
}
