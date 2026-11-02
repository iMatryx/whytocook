"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import type { ShellNavigationItem } from "@/config/navigation";
import { cn } from "@/shared/presentation/cn";
import { isRouteActive, normalizePathname } from "@/shared/presentation/shell-navigation";

export function ShellNavigationLinks({
  items,
  horizontal = false,
  onNavigate,
}: {
  items: readonly ShellNavigationItem[];
  horizontal?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className={cn(horizontal ? "flex items-center gap-1" : "space-y-1")}>
      {items.map((item) => {
        const active = isRouteActive(pathname, item.href);
        const exact = normalizePathname(pathname) === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? (exact ? "page" : "location") : undefined}
              onClick={(event) => {
                if (
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey &&
                  event.button === 0
                )
                  onNavigate?.();
              }}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active && "bg-accent text-accent-foreground",
              )}
            >
              {!horizontal && <Icon name={item.icon} className="size-5 shrink-0" />}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
