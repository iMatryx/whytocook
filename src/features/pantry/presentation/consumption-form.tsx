"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { expiryStatus } from "@/shared/domain/expiry";
import { pantryCommandSchema, unitCodeSchema } from "../contracts";
import type { PantryItem, PantryCommand, ConsumptionLine } from "../contracts";
import { previewConsumption } from "./pantry-model";
import { selectClass } from "./pantry-form";
export function ConsumptionForm({
  items,
  today,
  pending,
  onSave,
  onCancel,
}: {
  items: PantryItem[];
  today: string;
  pending: boolean;
  onSave: (command: PantryCommand) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, { quantity: string; unitCode: string }>>(
    {},
  );
  const [preview, setPreview] = useState<{
    lines: ConsumptionLine[];
    changes: ReturnType<typeof previewConsumption>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  function review(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const input = pantryCommandSchema.safeParse({
      kind: "consume",
      confirmed: true,
      lines: items.flatMap((item) => {
        const amount = amounts[item.id];
        return amount?.quantity.trim()
          ? [
              {
                itemId: item.id,
                expectedRevision: item.revision,
                quantity: amount.quantity,
                unitCode: amount.unitCode,
              },
            ]
          : [];
      }),
    });
    if (!input.success || input.data.kind !== "consume") {
      setError(
        "Introdu consumul pentru 1–50 de loturi: cantități pozitive, maximum 6 zecimale și bucăți întregi.",
      );
      return;
    }
    try {
      setPreview({ lines: input.data.lines, changes: previewConsumption(items, input.data.lines) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verifică selecția.");
    }
  }
  async function confirm() {
    if (!preview) return;
    setError(null);
    const message = await onSave({ kind: "consume", confirmed: true, lines: preview.lines });
    if (message) setError(message);
    else onCancel();
  }
  return (
    <div className="space-y-5">
      {preview ? (
        <>
          <h3 className="font-semibold">Verifică ce va rămâne</h3>
          <ul className="divide-y divide-border">
            {preview.changes.map((change) => (
              <li key={change.itemId} className="py-3">
                <span className="block font-medium">{change.name}</span>
                <span className="text-sm text-muted-foreground">
                  Consum: {change.used} {change.unitCode === "piece" ? "bucăți" : change.unitCode}.
                  Rămâne:{" "}
                  <strong className="text-foreground">
                    {change.remaining} {change.unitCode === "piece" ? "bucăți" : change.unitCode}
                  </strong>
                  .
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Cantitățile se schimbă numai după confirmare. Loturile epuizate rămân în inventar cu
            zero.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setPreview(null);
                setError(null);
              }}
            >
              Înapoi
            </Button>
            <Button type="button" loading={pending} onClick={() => void confirm()}>
              Confirmă consumul
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={review} className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Completează doar loturile folosite. Lasă celelalte câmpuri goale. Nu scădem ingrediente
            automat din rețete.
          </p>
          <fieldset disabled={pending} className="divide-y divide-border">
            <legend className="sr-only">Cantități consumate</legend>
            {items.map((item) => {
              const usable =
                item.quantity !== null &&
                Number(item.quantity) > 0 &&
                unitCodeSchema.safeParse(item.unitCode).success;
              const amount = amounts[item.id] ?? { quantity: "", unitCode: item.unitCode ?? "g" };
              const units = ["g", "kg"].includes(item.unitCode ?? "")
                ? ["g", "kg"]
                : ["ml", "l"].includes(item.unitCode ?? "")
                  ? ["ml", "l"]
                  : ["piece"];
              const expiry = expiryStatus(item.expiresOn, today);
              return (
                <div key={item.id} className="space-y-3 py-4">
                  <p className="font-medium">
                    {item.ingredient.name}
                    <span className="block text-xs font-normal text-muted-foreground">
                      Disponibil: {item.quantity ?? "necunoscut"}{" "}
                      {item.unitCode === "piece" ? "bucăți" : item.unitCode}; expirare:{" "}
                      {item.expiresOn ?? "nespecificată"}; lot {item.id.slice(-6)}.
                    </span>
                  </p>
                  {["expired", "today"].includes(expiry) && (
                    <p className="text-sm text-warning-foreground">
                      Verifică data și instrucțiunile de pe ambalaj înainte de utilizare.
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label={`Consum ${item.ingredient.name}, lot ${item.id.slice(-6)}`}
                      disabled={!usable}
                      inputMode="decimal"
                      maxLength={20}
                      value={amount.quantity}
                      onChange={(event) =>
                        setAmounts((old) => ({
                          ...old,
                          [item.id]: { ...amount, quantity: event.target.value },
                        }))
                      }
                      placeholder={usable ? "Cantitate folosită" : "Completează mai întâi stocul"}
                    />
                    <label className="space-y-2 text-sm">
                      <span className="block">Unitate consum, lot {item.id.slice(-6)}</span>
                      <select
                        className={selectClass}
                        value={amount.unitCode}
                        disabled={!usable}
                        onChange={(event) =>
                          setAmounts((old) => ({
                            ...old,
                            [item.id]: { ...amount, unitCode: event.target.value },
                          }))
                        }
                      >
                        {units.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit === "piece" ? "bucăți" : unit}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </fieldset>
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Anulează
            </Button>
            <Button type="submit">Verifică înainte de scădere</Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
