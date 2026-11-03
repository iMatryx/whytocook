"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { parseRecipeQuery } from "../contracts/search-query";
import type { RecipeFilters, RecipeSearchResponse } from "../contracts/search.schema";
const selectClass =
  "mt-2 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const difficulty = [
  { value: "easy", label: "Ușoară" },
  { value: "medium", label: "Medie" },
  { value: "hard", label: "Dificilă" },
];
const meals = [
  { value: "breakfast", label: "Mic dejun" },
  { value: "lunch", label: "Prânz" },
  { value: "dinner", label: "Cină" },
  { value: "dessert", label: "Desert" },
];
export const allergyOptions = [
  { value: "milk", label: "Lapte" },
  { value: "eggs", label: "Ouă" },
  { value: "gluten", label: "Gluten" },
  { value: "fish", label: "Pește" },
  { value: "tree_nuts", label: "Nuci" },
  { value: "peanuts", label: "Arahide" },
  { value: "soy", label: "Soia" },
  { value: "celery", label: "Țelină" },
  { value: "mustard", label: "Muștar" },
  { value: "sesame", label: "Susan" },
  { value: "crustaceans", label: "Crustacee" },
  { value: "sulphites", label: "Sulfiți" },
  { value: "lupin", label: "Lupin" },
  { value: "molluscs", label: "Moluște" },
];
type Option = { value: string; label: string };
function Multi({
  name,
  label,
  values,
  options,
}: {
  name: string;
  label: string;
  values: string[];
  options: Option[];
}) {
  const combined = [
    ...options,
    ...values
      .filter((v) => !options.some((o) => o.value === v))
      .map((value) => ({ value, label: value })),
  ];
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        className={selectClass}
        multiple
        name={name}
        defaultValue={values}
        size={3}
        aria-label={label}
      >
        {combined.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function RecipeFiltersForm({
  filters,
  facets,
  onApply,
  onReset,
}: {
  filters: RecipeFilters;
  facets: RecipeSearchResponse["facets"] | undefined;
  onApply: (f: RecipeFilters) => void;
  onReset: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget))
      if (typeof value === "string" && value !== "") params.append(key, value);
    const parsed = parseRecipeQuery(params);
    if (!parsed.success) {
      setError(parsed.message);
      return;
    }
    setError(null);
    onApply(parsed.data);
  }
  const advanced = !!(
    filters.budget ||
    filters.calories ||
    filters.protein ||
    filters.cuisine.length ||
    filters.diet.length ||
    filters.equipment.length ||
    filters.exclude.length ||
    filters.allergy.length ||
    filters.ingredient.length
  );
  return (
    <form onSubmit={submit} className="space-y-5" aria-label="Filtre rețete">
      <TextField
        label="Caută după nume sau ingrediente"
        name="q"
        defaultValue={filters.q}
        maxLength={120}
        placeholder="De exemplu, roșii sau mămăligă"
      />
      <label className="block text-sm font-medium">
        Colecție
        <select className={selectClass} name="source" defaultValue={filters.source}>
          <option value="published">Rețete publicate</option>
          <option value="demo">Exemple demonstrative</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Timp maxim (minute)"
          name="minutes"
          type="number"
          min="1"
          max="10080"
          defaultValue={filters.minutes ?? ""}
        />
        <TextField
          label="Porții pentru matching"
          name="servings"
          type="number"
          min="1"
          max="20"
          defaultValue={filters.servings ?? ""}
        />
      </div>
      <Multi
        name="difficulty"
        label="Dificultate"
        values={filters.difficulty}
        options={difficulty}
      />
      <Multi name="meal" label="Tip de masă" values={filters.meal} options={meals} />
      <details open={advanced || undefined} className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer rounded-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Filtre avansate
        </summary>
        <div className="mt-5 space-y-5">
          <p className="text-xs text-muted-foreground">
            Pentru selecție multiplă folosește Ctrl sau Cmd pe desktop. Grupele de filtre se
            combină.
          </p>
          <Multi
            name="ingredient"
            label="Ingrediente cerute"
            values={filters.ingredient}
            options={facets?.ingredients ?? []}
          />
          <Multi
            name="cuisine"
            label="Bucătărie"
            values={filters.cuisine}
            options={facets?.cuisines ?? []}
          />
          <Multi name="diet" label="Dietă" values={filters.diet} options={facets?.diets ?? []} />
          <Multi
            name="equipment"
            label="Echipament disponibil"
            values={filters.equipment}
            options={facets?.equipment ?? []}
          />
          <p className="text-xs text-muted-foreground">
            Selectează ce ai; rețeta nu poate cere alte echipamente. Fără selecție, nu limităm
            echipamentul.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Buget maxim / porție"
              name="budget"
              type="number"
              min="0"
              max="999999"
              step="0.01"
              defaultValue={filters.budget ?? ""}
            />
            <label className="block text-sm font-medium">
              Monedă
              <select className={selectClass} name="currency" defaultValue={filters.currency}>
                <option value="MDL">MDL</option>
                <option value="RON">RON</option>
              </select>
            </label>
          </div>
          <TextField
            label="Calorii maxime / porție"
            name="calories"
            type="number"
            min="0"
            max="999999"
            step="0.01"
            defaultValue={filters.calories ?? ""}
          />
          <TextField
            label="Proteine minime (g) / porție"
            name="protein"
            type="number"
            min="0"
            max="999999"
            step="0.01"
            defaultValue={filters.protein ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Filtrele numerice includ numai valori verificate, în moneda selectată.
          </p>
          <Multi
            name="exclude"
            label="Ingrediente excluse"
            values={filters.exclude}
            options={facets?.ingredients ?? []}
          />
          <Multi
            name="allergy"
            label="Alergeni excluși"
            values={filters.allergy}
            options={allergyOptions}
          />
          <p className="text-xs text-muted-foreground">
            Restricțiile din profil se aplică suplimentar. Datele despre alergeni neverificate
            exclud rețeta când ai declarat alergii.
          </p>
        </div>
      </details>
      <label className="block text-sm font-medium">
        Compatibilitate
        <select className={selectClass} name="compatibility" defaultValue={filters.compatibility}>
          <option value="any">Toate rezultatele</option>
          <option value="ready_to_cook">Pot găti acum</option>
          <option value="almost_ready">Aproape gata</option>
          <option value="missing_ingredients">Ingrediente lipsă</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        Sortează după
        <select className={selectClass} name="sort" defaultValue={filters.sort}>
          <option value="compatibility">Compatibilitate</option>
          <option value="relevance">Relevanță</option>
          <option value="time">Timp crescător</option>
          <option value="budget">Buget crescător</option>
          <option value="calories">Calorii crescător</option>
          <option value="protein">Proteine descrescător</option>
          <option value="name">Nume</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        Rețete pe pagină
        <select className={selectClass} name="size" defaultValue={filters.size}>
          <option value="6">6</option>
          <option value="12">12</option>
          <option value="24">24</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Aplică filtrele</Button>
        <Button type="button" variant="outline" onClick={onReset}>
          Resetează filtrele
        </Button>
      </div>
    </form>
  );
}
