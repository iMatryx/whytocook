import "server-only";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import type { ShellPageContent } from "@/config/shell-pages";

export function PagePlaceholder({
  content,
  children,
}: {
  content: ShellPageContent;
  children?: ReactNode;
}) {
  return (
    <div>
      <Badge tone="accent">În pregătire</Badge>
      <h1 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">{content.title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        {content.description}
      </p>
      <section
        aria-labelledby="placeholder-heading"
        className="mt-10 rounded-2xl border border-border bg-card p-6 text-card-foreground sm:p-10"
      >
        <span className="mb-5 inline-flex rounded-full bg-accent p-3 text-accent-foreground">
          <Icon name={content.icon} className="size-7" />
        </span>
        <h2 id="placeholder-heading" className="text-xl font-semibold">
          {content.emptyTitle}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {content.emptyDescription}
        </p>
        {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
      </section>
    </div>
  );
}
