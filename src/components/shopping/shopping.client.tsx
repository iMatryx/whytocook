"use client";
import { useMemo } from "react";
import { usePantry } from "@/features/pantry/presentation/use-pantry";
import { ShoppingView } from "@/features/shopping/presentation/shopping-view";
import { loadLocalShopping, mutateLocalShopping } from "./local-shopping";
import type { LocalShoppingPort } from "@/features/shopping/presentation/use-shopping";
async function locked<T>(work: () => T) {
  if (navigator.locks)
    return navigator.locks.request("cookly-pantry-v1", () =>
      navigator.locks.request("cookly-shopping-v1", work),
    );
  return work();
}
export function ShoppingClient() {
  const pantry = usePantry();
  const local = useMemo<LocalShoppingPort>(
    () => ({
      load: (catalog, current) =>
        locked(() => {
          if (!current()) throw new Error("Contextul s-a schimbat.");
          return loadLocalShopping(localStorage, catalog);
        }),
      mutate: (catalog, command, id, current) =>
        locked(() => {
          if (!current()) throw new Error("Contextul s-a schimbat.");
          return mutateLocalShopping(localStorage, catalog, command, id);
        }),
    }),
    [],
  );
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
    <ShoppingView
      local={local}
      inventory={inventory}
      pantryReady={pantry.status === "ready"}
      pantryAccountId={pantry.accountId}
      onRefreshPantry={() => void pantry.reload()}
    />
  );
}
