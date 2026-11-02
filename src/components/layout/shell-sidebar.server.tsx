import "server-only";

import { shellNavigation, shellNavigationGroups } from "@/config/navigation";

import { ShellNavigationLinks } from "./shell-navigation-links";

export function ShellSidebar() {
  return (
    <aside className="hidden border-r border-border py-8 pr-5 lg:block">
      <nav aria-label="Navigare principală" className="space-y-7">
        {shellNavigationGroups
          .filter((group) => group.key !== "account")
          .map((group) => (
            <div key={group.key}>
              <p className="mb-2 px-3 text-xs font-semibold text-muted-foreground">{group.label}</p>
              <ShellNavigationLinks
                items={shellNavigation.filter((item) => item.group === group.key)}
              />
            </div>
          ))}
      </nav>
    </aside>
  );
}
