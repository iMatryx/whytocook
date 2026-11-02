import { connection } from "next/server";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { shellNavigation } from "@/config/navigation";
import { getServerEnv } from "@/config/env/server";

export default async function HomePage() {
  await connection();
  getServerEnv();
  return (
    <div>
      <Badge tone="accent">În pregătire</Badge>
      <h1 className="mt-5 max-w-3xl font-display text-5xl leading-tight tracking-tight sm:text-6xl">
        Cookly începe aici.
      </h1>
      <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
        Un loc pentru ideile tale de gătit. Pregătim lucrurile pas cu pas, cu grijă pentru mesele de
        zi cu zi.
      </p>
      <div className="mt-12 max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground">
        <h2 className="font-medium">Lucrurile bune au nevoie de puțin timp.</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Spațiul tău de gătit se pregătește. Revenim în curând.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {shellNavigation
          .filter((item) => ["/recipes", "/my-fridge", "/meal-planner"].includes(item.href))
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-border bg-card p-5 text-card-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon name={item.icon} className="mb-3 text-primary" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
      </div>
    </div>
  );
}
