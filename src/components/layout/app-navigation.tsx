"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/shared/presentation/cn";

export type NavigationItem = { label: string; href: string };
export type AppNavigationProps = { items: readonly NavigationItem[]; activeHref?: string; label?: string; actions?: ReactNode; onNavigate?: (href: string) => void };

export function AppNavigation({ items, activeHref, label = "Navigare principală", actions, onNavigate }: AppNavigationProps) {
  const [open, setOpen] = useState(false);
  const pendingAnchor = useRef<string | null>(null);
  const renderLinks = (mobile: boolean) => items.map((item) => (
    <Link key={item.href} href={item.href} aria-current={activeHref === item.href ? (item.href.startsWith("#") ? "location" : "page") : undefined} className={cn("rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring", activeHref === item.href && "bg-accent text-accent-foreground", mobile && "block text-base")} onClick={() => { onNavigate?.(item.href); if (mobile) { pendingAnchor.current = item.href.startsWith("#") ? item.href.slice(1) : null; setOpen(false); } }}>{item.label}</Link>
  ));
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Cookly — pagina principală" className="shrink-0 rounded-sm text-2xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring">Cookly<span className="text-primary">.</span></Link>
        <nav aria-label={label} className="hidden items-center gap-1 lg:flex">{renderLinks(false)}</nav>
        <div className="flex items-center gap-3">
          {actions}
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild><Button variant="outline" size="icon" aria-label="Deschide navigarea" className="lg:hidden"><Icon name="menu" /></Button></DrawerTrigger>
            <DrawerContent title="Navigare" description="Alege secțiunea pe care vrei să o deschizi." onCloseAutoFocus={(event) => { const target = pendingAnchor.current ? document.getElementById(pendingAnchor.current) : null; pendingAnchor.current = null; if (target) { event.preventDefault(); target.focus(); } }}>
              <nav aria-label={`${label} — mobil`} className="space-y-1">{renderLinks(true)}</nav>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </header>
  );
}
