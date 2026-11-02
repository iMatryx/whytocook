"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, FormState, ProfileData, ProfileOptions } from "../contracts";

const initial: FormState = { status: "idle" };
const selectClass =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function ProfileForm({
  action,
  profile,
  options,
}: {
  action: FormAction;
  profile: ProfileData;
  options: ProfileOptions;
}) {
  const [state, submit, pending] = useActionState(action, initial);
  const groups = [
    {
      name: "dietIds",
      label: "Preferințe alimentare",
      values: options.diets,
      selected: profile.diet_ids,
    },
    {
      name: "allergenIds",
      label: "Alergeni de exclus",
      values: options.allergens,
      selected: profile.allergen_ids,
    },
    {
      name: "equipmentIds",
      label: "Echipamente disponibile",
      values: options.equipment,
      selected: profile.equipment_ids,
    },
  ];
  return (
    <form action={submit} className="space-y-8" aria-busy={pending}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="displayName"
          label="Nume afișat"
          required
          maxLength={80}
          autoComplete="nickname"
          defaultValue={profile.display_name ?? ""}
          error={state.fieldErrors?.displayName?.[0]}
        />
        <label className="space-y-2 text-sm font-medium">
          <span className="block">Limba preferată</span>
          <select className={selectClass} name="locale" defaultValue={profile.locale}>
            <option value="ro-RO">Română</option>
            <option value="en-GB">English</option>
          </select>
        </label>
        <TextField
          name="timeZone"
          label="Fus orar"
          required
          defaultValue={profile.time_zone}
          hint="De exemplu Europe/Chisinau sau Europe/Bucharest."
          error={state.fieldErrors?.timeZone?.[0]}
        />
        <TextField
          name="householdSize"
          label="Număr de persoane"
          type="number"
          required
          min={1}
          max={20}
          defaultValue={profile.household_size}
          error={state.fieldErrors?.householdSize?.[0]}
        />
        <TextField
          name="mealBudget"
          label="Buget pentru o masă"
          type="number"
          min="0.01"
          max="999999.99"
          step="0.01"
          defaultValue={profile.meal_budget?.replace(/(\.\d{2})\d*$/, "$1") ?? ""}
          hint="Pentru toate persoanele din profil. Opțional."
          error={state.fieldErrors?.mealBudget?.[0]}
        />
        <label className="space-y-2 text-sm font-medium">
          <span className="block">Monedă</span>
          <select className={selectClass} name="currency" defaultValue={profile.currency}>
            {["MDL", "RON", "EUR", "USD"].map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>
      {groups.map((group) => (
        <fieldset key={group.name} className="rounded-xl border border-border p-5">
          <legend className="px-2 font-semibold">{group.label}</legend>
          {group.values.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Opțiunile nu sunt disponibile momentan. Reîncarcă pagina.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.values.map((option) => (
                <label
                  key={option.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
                >
                  <input
                    className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                    type="checkbox"
                    name={group.name}
                    value={option.id}
                    defaultChecked={group.selected.includes(option.id)}
                  />
                  {option.name}
                </label>
              ))}
            </div>
          )}
          {state.fieldErrors?.[group.name] && (
            <p role="alert" className="mt-2 text-sm text-danger-foreground">
              Verifică selecția.
            </p>
          )}
        </fieldset>
      ))}
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "rounded-md bg-danger p-3 text-danger-foreground"
              : "rounded-md bg-accent p-3 text-accent-foreground"
          }
        >
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Se salvează…" : "Salvează profilul"}
      </Button>
    </form>
  );
}
