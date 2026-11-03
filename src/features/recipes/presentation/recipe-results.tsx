"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { RecipeSearchResponse } from "../contracts/search.schema";
import { recipeDetailHref } from "../contracts/detail-query";
const categories = {
  ready_to_cook: "Poți găti",
  almost_ready: "Aproape gata",
  missing_ingredients: "Ingrediente lipsă",
} as const;
type Item = RecipeSearchResponse["items"][number];
export function RecipeResults({
  data,
  query,
}: {
  data: RecipeSearchResponse;
  query: Parameters<typeof recipeDetailHref>[1];
}) {
  const [selected, setSelected] = useState<Item | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        {data.items.map((item) => {
          const r = item.recipe,
            m = item.compatibility;
          return (
            <article
              key={r.key}
              className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 sm:p-6"
              aria-labelledby={`recipe-${r.key}`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Badge tone={m?.category === "ready_to_cook" ? "success" : "neutral"}>
                  {m ? categories[m.category] : "Compatibilitate indisponibilă"}
                </Badge>
                {m && (
                  <span
                    className="text-sm font-semibold tabular-nums"
                    aria-label={`Compatibilitate: ${m.score} din 100`}
                  >
                    {m.score}/100
                  </span>
                )}
              </div>
              <h2 id={`recipe-${r.key}`} className="font-display text-2xl leading-tight">
                <Link
                  className="rounded-sm underline decoration-border underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={recipeDetailHref(r.key, query)}
                >
                  {r.title}
                </Link>
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {r.totalMinutes} min · {r.servings} porții de bază ·{" "}
                {r.difficulty === "easy"
                  ? "Ușoară"
                  : r.difficulty === "medium"
                    ? "Medie"
                    : "Dificilă"}
              </p>
              <p className="mt-4 text-sm leading-relaxed">
                {r.ingredients
                  .slice(0, 5)
                  .map((i) => i.name)
                  .join(", ")}
                {r.ingredients.length > 5 ? ` și încă ${r.ingredients.length - 5}` : ""}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Cost / porție</dt>
                  <dd>{r.budget ? `${r.budget.amount} ${r.budget.currency}` : "Necunoscut"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nutriție / porție</dt>
                  <dd>
                    {r.nutrition
                      ? `${r.nutrition.calories} kcal · ${r.nutrition.protein} g proteine`
                      : "Neverificată"}
                  </dd>
                </div>
              </dl>
              {r.dataClass !== "verified" && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {r.dataClass === "demonstration"
                    ? "Rețetă demonstrativă, netestată practic."
                    : "Rețetă fără verificare editorială completă."}
                </p>
              )}
              <Button
                className="mt-5 self-start"
                variant="outline"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setSelected(item);
                }}
                aria-label={`Vezi rețeta ${r.title}`}
              >
                Vezi rețeta și ingredientele
              </Button>
            </article>
          );
        })}
      </div>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          title={selected?.recipe.title ?? "Rețetă"}
          description={
            selected?.recipe.dataClass === "demonstration"
              ? "Exemplu demonstrativ. Verifică ingredientele, alergenii și prepararea înainte de utilizare."
              : "Ingrediente, pași și potrivirea cu inventarul tău."
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          {selected && (
            <div className="space-y-6">
              <section>
                <h3 className="font-semibold">
                  Ingrediente pentru {selected.recipe.servings} porții de bază
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {selected.recipe.ingredients.map((i) => (
                    <li key={i.ingredientSlug}>
                      {i.quantity} {i.unit} {i.name}
                      {i.optional ? " (opțional)" : ""} — {i.preparation}
                    </li>
                  ))}
                </ul>
              </section>
              {selected.compatibility && (
                <section>
                  <h3 className="font-semibold">
                    Compatibilitate: {selected.compatibility.score}/100
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {selected.compatibility.explanations.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                  <h4 className="mt-4 font-medium">Cantități pentru porțiile cerute</h4>
                  <ul className="mt-2 space-y-2 text-sm">
                    {selected.compatibility.ingredients.map((i) => (
                      <li key={i.ingredientSlug}>
                        {
                          selected.recipe.ingredients.find(
                            (v) => v.ingredientSlug === i.ingredientSlug,
                          )?.name
                        }
                        : necesar {i.required} {i.unit}, disponibil măsurat {i.available} {i.unit},
                        deficit {i.shortage} {i.unit}
                        {i.uncertain ? "; există cantități necunoscute de verificat" : ""}
                        {i.optional ? " (opțional)" : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <h3 className="font-semibold">Pași de preparare</h3>
                <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
                  {selected.recipe.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </section>
              <p className="text-sm text-muted-foreground">
                Alergeni:{" "}
                {selected.recipe.allergens.status === "verified"
                  ? "informații verificate"
                  : "informații neverificate"}
                . Vizualizarea nu scade cantități din inventar.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
