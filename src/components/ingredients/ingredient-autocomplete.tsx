"use client";
import { Combobox } from "@/components/ui/combobox";
import type { IngredientSummary } from "@/features/ingredients/contracts";

export function IngredientAutocomplete({
  query,
  onQueryChange,
  value,
  onValueChange,
  options,
  loading,
  error,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  value: IngredientSummary | null;
  onValueChange: (value: IngredientSummary | null) => void;
  options: readonly IngredientSummary[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <Combobox
      label="Caută un ingredient"
      name="ingredientId"
      value={value?.id ?? ""}
      queryValue={query}
      filterMode="remote"
      onQueryChange={(text) => {
        onQueryChange(text);
        if (value && text !== value.name) onValueChange(null);
      }}
      options={options.slice(0, 8).map((item) => ({
        value: item.id,
        label: `${item.name}${item.name !== item.canonicalName ? ` — ${item.canonicalName}` : ""}${item.kind === "generic" ? " (general)" : ""}`,
      }))}
      onValueChange={(id) => {
        const item = options.find((option) => option.id === id);
        if (item) {
          onValueChange(item);
          onQueryChange(item.name);
        }
      }}
      loading={loading}
      placeholder="Roșii, tomatoes, помидоры…"
      hint="Alege explicit varianta potrivită. Sugestiile nu sunt substituții culinare."
      emptyMessage={
        query.trim().length < 2 && query !== ""
          ? "Tastează cel puțin două caractere."
          : "Nu am găsit ingrediente. Încearcă altă denumire."
      }
      {...(error ? { error } : {})}
    />
  );
}
