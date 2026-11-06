"use client";
import { useMemo } from "react";
import { usePantry } from "@/features/pantry/presentation/use-pantry";
import { PlannerView } from "@/features/meal-planner/presentation/planner-view";
import type { LocalPlannerPort } from "@/features/meal-planner/presentation/use-planner";
import { plannerKey } from "@/features/meal-planner/presentation/planner-storage";
import { loadLocalPlanner, mutateLocalPlanner, exportLocalPlanner } from "./local-planner";
async function locks<T>(names: string[], work: () => T): Promise<T> {
  const keys = [...new Set(names)].sort();
  async function next(i: number): Promise<T> {
    return i === keys.length ? work() : navigator.locks.request(keys[i]!, () => next(i + 1));
  }
  return navigator.locks ? next(0) : work();
}
export function PlannerClient() {
  const pantry = usePantry();
  const local = useMemo<LocalPlannerPort>(
    () => ({
      load: (day, source, current) =>
        locks([plannerKey(day, source), "cookly-shopping-v1"], () => {
          if (!current()) throw new Error("Contextul s-a schimbat.");
          return loadLocalPlanner(localStorage, day, source);
        }),
      mutate: (day, source, command, revision, id, recipes, current) =>
        locks(
          [
            plannerKey(day, source),
            "cookly-shopping-v1",
            ...(command.kind === "copyWeek" ? [plannerKey(command.targetStartsOn, source)] : []),
          ],
          () => {
            if (!current()) throw new Error("Contextul s-a schimbat.");
            return mutateLocalPlanner(localStorage, day, source, command, revision, id, recipes);
          },
        ),
      exportWeek: (day, source, revision, id, items, inventory, current) =>
        locks([plannerKey(day, source), "cookly-shopping-v1", "cookly-pantry-v1"], () => {
          if (!current()) throw new Error("Contextul s-a schimbat.");
          return exportLocalPlanner(localStorage, day, source, revision, id, items, inventory);
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
    <PlannerView
      local={local}
      inventory={inventory}
      pantryReady={pantry.status === "ready"}
      pantryAccountId={pantry.accountId}
    />
  );
}
