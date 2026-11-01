"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState, type MouseEvent } from "react";

import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/shared/presentation/cn";

import { CompatibilityBadge } from "./compatibility-badge";
import type { CompatibilityStatus } from "./compatibility";

export type RecipeCardProps = {
  title: string;
  description?: string;
  timeLabel: string;
  servingsLabel: string;
  costLabel?: string;
  image?: { src: string; alt: string };
  compatibility: CompatibilityStatus;
  favorite?: boolean;
  onFavoriteChange?: (favorite: boolean) => void;
  className?: string;
} & ({ href: string; onOpen?: never } | { href?: never; onOpen?: (event: MouseEvent<HTMLButtonElement>) => void });

export function RecipeCard({ title, description, timeLabel, servingsLabel, costLabel, image, compatibility, favorite = false, onFavoriteChange, href, onOpen, className }: RecipeCardProps) {
  const id = useId();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const titleStyles = "rounded-sm text-left outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <article aria-labelledby={id} className={cn("min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground", className)}>
      <div className="relative aspect-[4/3] bg-muted">
        {image && failedImage !== image.src ? <Image src={image.src} alt={image.alt} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" onError={() => setFailedImage(image.src)} /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><Icon name="leaf" className="size-9" /><span className="text-sm">Fără fotografie</span></div>}
        {onFavoriteChange && <button type="button" aria-label={`Favorită: ${title}`} aria-pressed={favorite} onClick={() => onFavoriteChange(!favorite)} className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-full bg-card text-primary shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Icon name="heart" fill={favorite ? "currentColor" : "none"} /></button>}
      </div>
      <div className="p-5">
        <CompatibilityBadge status={compatibility} />
        <h3 id={id} className="mt-4 font-display text-2xl leading-tight">{href ? <Link href={href} className={titleStyles}>{title}</Link> : onOpen ? <button type="button" className={titleStyles} onClick={onOpen}>{title}</button> : title}</h3>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        <ul aria-label="Detalii rețetă" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5"><Icon name="clock" className="size-4" />{timeLabel}</li>
          <li className="flex items-center gap-1.5"><Icon name="people" className="size-4" />{servingsLabel}</li>
        </ul>
        <p className="mt-4 border-t border-border pt-4 text-sm font-medium">{costLabel ?? "Cost indisponibil"}</p>
      </div>
    </article>
  );
}

export function RecipeCardSkeleton() {
  return <div role="status" aria-label="Se încarcă o rețetă" className="overflow-hidden rounded-2xl border border-border bg-card"><Skeleton className="aspect-[4/3] rounded-none" /><div className="space-y-4 p-5"><Skeleton className="h-7 w-36" /><Skeleton className="h-8 w-4/5" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div></div>;
}
