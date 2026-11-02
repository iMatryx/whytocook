"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import { shellNavigation, shellNavigationGroups } from "@/config/navigation";

import { ShellNavigationLinks } from "./shell-navigation-links";

export function MobileNavigation() {
  const pathname = usePathname();
  const [menu, setMenu] = useState({ pathname, open: false, focusContent: false });

  // Keep the trigger mounted; close route-bound state before rendering the new route.
  if (menu.pathname !== pathname) {
    setMenu({ pathname, open: false, focusContent: menu.focusContent || menu.open });
  }

  return (
    <Drawer
      open={menu.pathname === pathname && menu.open}
      onOpenChange={(open) => setMenu({ pathname, open, focusContent: false })}
    >
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Deschide meniul Cookly"
          className="lg:hidden"
        >
          <Icon name="menu" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        title="Navigare Cookly"
        description="Alege unde vrei să mergi."
        onCloseAutoFocus={(event) => {
          if (menu.focusContent) {
            event.preventDefault();
            setMenu((current) => ({ ...current, focusContent: false }));
            requestAnimationFrame(() => document.getElementById("main-content")?.focus());
          }
        }}
      >
        <nav aria-label="Navigare mobilă" className="space-y-6">
          {shellNavigationGroups.map((group) => (
            <div key={group.key}>
              <p className="mb-2 px-3 text-xs font-semibold text-muted-foreground">{group.label}</p>
              <ShellNavigationLinks
                items={shellNavigation.filter((item) => item.group === group.key)}
                onNavigate={() => {
                  setMenu({ pathname, open: false, focusContent: true });
                }}
              />
            </div>
          ))}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
