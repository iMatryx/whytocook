import { connection } from "next/server";

import { ThemeControl } from "@/components/theme/theme-control";
import { getServerEnv } from "@/config/env/server";

export default async function HomePage() {
  await connection();
  getServerEnv();
  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-6 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-6">
        <span className="text-2xl font-semibold tracking-tight">Cookly<span className="text-primary">.</span></span>
        <ThemeControl />
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col justify-center py-20 outline-none sm:py-28">
        <p className="mb-6 text-sm font-medium tracking-widest text-primary uppercase">În pregătire</p>
        <h1 className="max-w-3xl text-5xl leading-tight font-semibold tracking-tight sm:text-7xl">Cookly începe aici.</h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">Un loc pentru ideile tale de gătit. Pregătim lucrurile pas cu pas, cu grijă pentru mesele de zi cu zi.</p>
        <div className="mt-12 max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground">
          <h2 className="font-medium">Lucrurile bune au nevoie de puțin timp.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Spațiul tău de gătit se pregătește. Revenim în curând.</p>
        </div>
      </main>
      <footer className="border-t border-border py-6 text-sm text-muted-foreground">Mai multă inspirație la fiecare masă.</footer>
    </div>
  );
}
