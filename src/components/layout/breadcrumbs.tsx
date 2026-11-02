"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getBreadcrumbs } from "@/shared/presentation/shell-navigation";

export function Breadcrumbs() {
  const items = getBreadcrumbs(usePathname());
  return (
    <nav aria-label="Traseu de navigare" className="mb-8 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
