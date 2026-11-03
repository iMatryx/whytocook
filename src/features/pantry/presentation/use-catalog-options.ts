"use client";
import { useEffect, useState } from "react";
import { ingredientSearchResultSchema } from "@/features/ingredients/contracts";
import type { IngredientSummary } from "@/features/ingredients/contracts";
export function useCatalogOptions(query: string) {
  const [result, setResult] = useState<{
    key: string;
    options: IngredientSummary[];
    error: string | null;
  } | null>(null);
  const valid = query === "" || query.trim().length >= 2;
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ query, limit: "8", locale: "ro-RO" });
          const response = await fetch(`/api/v1/ingredients?${params}`, {
            signal: controller.signal,
            credentials: "omit",
            cache: "no-store",
          });
          if (!response.ok) throw new Error();
          const data = ingredientSearchResultSchema.parse(await response.json());
          if (!controller.signal.aborted)
            setResult({ key: query, options: data.items, error: null });
        } catch {
          if (!controller.signal.aborted)
            setResult({
              key: query,
              options: [],
              error: "Catalogul nu este disponibil. Încearcă alt termen sau redeschide formularul.",
            });
        }
      })();
    }, 225);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, valid]);
  return {
    options: valid && result?.key === query ? result.options : [],
    loading: valid && result?.key !== query,
    error: result?.key === query ? result.error : null,
  };
}
