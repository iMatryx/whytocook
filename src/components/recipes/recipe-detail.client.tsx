"use client";
import { useMemo, useState } from "react";
import { usePantry } from "@/features/pantry/presentation/use-pantry";
import type { PantryItem } from "@/features/pantry/contracts";
import { ConsumptionForm } from "@/features/pantry/presentation/consumption-form";
import { RecipeDetailView } from "@/features/recipes/presentation/recipe-detail-view";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { localCalendarDay } from "@/shared/domain/expiry";
export function RecipeDetailClient({ slug }: { slug: string }) {
  const pantry = usePantry(),
    [consumption, setConsumption] = useState<{ scope: string; items: PantryItem[] } | null>(null),
    [notice, setNotice] = useState<string | null>(null);
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
    <>
      <RecipeDetailView
        slug={slug}
        inventory={inventory}
        accountId={pantry.accountId}
        inventoryStatus={pantry.status}
        inventoryError={pantry.error}
        onRetryInventory={() => void pantry.reload()}
        onConsume={(slugs) =>
          setConsumption({
            scope: pantry.accountId ?? "guest",
            items: pantry.items.filter((i) => slugs.includes(i.ingredient.slug)),
          })
        }
        notice={notice}
      />
      <Dialog
        open={consumption !== null}
        onOpenChange={(open) => {
          if (!open) setConsumption(null);
        }}
      >
        <DialogContent
          title="Confirmă consumul real"
          description="Completează loturile folosite. Preview-ul nu modifică stocul; numai confirmarea finală îl actualizează."
        >
          {consumption && (pantry.accountId ?? "guest") !== consumption.scope ? (
            <ErrorState
              title="Contul s-a schimbat"
              description="Închide dialogul și reîncarcă inventarul."
            />
          ) : pantry.status === "error" ? (
            <ErrorState
              title="Inventarul nu poate fi verificat"
              description={pantry.error ?? "Reîncarcă inventarul înainte de consum."}
              onRetry={() => void pantry.reload()}
            />
          ) : consumption && pantry.status === "ready" ? (
            consumption.items.length ? (
              <ConsumptionForm
                items={consumption.items}
                today={localCalendarDay()}
                pending={pantry.saving}
                onSave={async (command) => {
                  const error = await pantry.save(command, null, consumption.scope);
                  if (!error) setNotice("Inventar actualizat după confirmarea consumului.");
                  return error;
                }}
                onCancel={() => setConsumption(null)}
              />
            ) : (
              <EmptyState
                compact
                title="Nu există loturi ale rețetei în inventar"
                description="Nu avem cantități pe care să le scădem. Marcarea ca gătită rămâne independentă."
              />
            )
          ) : (
            <p role="status">Se verifică inventarul…</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
