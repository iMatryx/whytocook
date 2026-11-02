import Link from "next/link";
import type { ReactNode } from "react";

export function AuthPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg py-4 sm:py-10">
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
        <p className="mb-7 mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children}
      </section>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link href="/recipes" className="underline underline-offset-4">
          Explorează rețetele fără cont
        </Link>
      </p>
    </div>
  );
}
