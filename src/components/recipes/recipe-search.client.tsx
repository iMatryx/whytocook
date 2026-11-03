"use client";
import { useMemo } from "react";
import { usePantry } from "@/features/pantry/presentation/use-pantry";
import { RecipeSearchView } from "@/features/recipes/presentation/recipe-search-view";
export function RecipeSearchClient() {
  const pantry = usePantry();
  const inventory = useMemo(
    () =>
      pantry.items.map((i) => ({
        id: i.id,
        ingredientSlug: i.ingredient.slug,
        quantity: i.quantity,
        unit: i.unitCode,
        expiresOn: i.expiresOn,
      })),
    [pantry.items],
  );
  return (
    <RecipeSearchView
      inventory={inventory}
      accountId={pantry.accountId}
      inventoryStatus={pantry.status}
      inventoryError={pantry.error}
      onRetryInventory={() => void pantry.reload()}
    />
  );
}
