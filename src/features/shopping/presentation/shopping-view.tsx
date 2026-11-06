"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { localCalendarDay } from "@/shared/domain/expiry";
import { estimateShopping, shoppingText } from "@/shared/domain/shopping";
import {
  shoppingPreviewRequestSchema,
  shoppingPreviewSchema,
  shoppingInputSchema,
} from "../contracts";
import type {
  ShoppingBootstrap,
  ShoppingCommand,
  ShoppingItem,
  RecipeSelection,
} from "../contracts";
import type { RecipeSearchRequest } from "@/features/recipes/contracts";
import { ItemForm, shoppingSelect } from "./item-form";
import { useShopping } from "./use-shopping";
import type { LocalShoppingPort } from "./use-shopping";
type Props = {
  local: LocalShoppingPort;
  inventory: RecipeSearchRequest["inventory"];
  pantryReady: boolean;
  pantryAccountId: string | null;
  onRefreshPantry: () => void;
};
export function ShoppingView(props: Props) {
  const params = useSearchParams(),
    router = useRouter(),
    source = params.get("source") === "demo" ? "demo" : "published",
    shopping = useShopping(source, props.local);
  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-4xl">Lista de cumpărături</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Adună necesarul pentru mesele tale, verifică ce ai deja și cumpără cât îți lipsește.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/my-fridge">Vezi frigiderul</Link>
          </Button>
          <Button
            variant="outline"
            aria-pressed={source === "published"}
            onClick={() => router.replace("/shopping-list")}
          >
            Rețete publicate
          </Button>
          <Button
            variant="outline"
            aria-pressed={source === "demo"}
            onClick={() => router.replace("/shopping-list?source=demo")}
          >
            Exemple demonstrative
          </Button>
        </div>
      </header>
      {source === "demo" && (
        <p className="rounded-xl bg-warning p-4 text-sm text-warning-foreground">
          Rețetele demo sunt netestate practic. Cantitățile trebuie revizuite înainte de
          cumpărături.
        </p>
      )}
      {shopping.error && (
        <ErrorState
          title="Lista nu poate fi confirmată"
          description={shopping.error}
          onRetry={() => void shopping.reload()}
        />
      )}
      {!shopping.data && !shopping.error && <p role="status">Se încarcă lista și catalogul…</p>}
      {shopping.data && (
        <ShoppingContent
          key={`${source}:${shopping.data.accountId}`}
          data={shopping.data}
          source={source}
          busy={shopping.busy}
          run={shopping.run}
          {...props}
        />
      )}
    </div>
  );
}
function ShoppingContent({
  data,
  source,
  busy,
  run,
  inventory,
  pantryReady,
  pantryAccountId,
  onRefreshPantry,
}: {
  data: ShoppingBootstrap;
  source: "demo" | "published";
  busy: boolean;
  run: (c: ShoppingCommand) => Promise<boolean>;
} & Props) {
  const [editor, setEditor] = useState<ShoppingItem | "new" | null>(null),
    [purchase, setPurchase] = useState(false),
    [share, setShare] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [localError, setLocalError] = useState<string | null>(null),
    [generating, setGenerating] = useState(false),
    [selections, setSelections] = useState<RecipeSelection[]>([]),
    [optional, setOptional] = useState(false),
    [preview, setPreview] = useState<{
      context: string;
      items: ShoppingItem[];
      explanations: string[];
    } | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null),
    today = localCalendarDay(),
    context = JSON.stringify([source, data.accountId, inventory, selections, optional]),
    eligible = data.items.filter(
      (i) =>
        i.checked &&
        !i.transferred &&
        !i.uncertain &&
        i.ingredient?.active &&
        i.quantity !== null &&
        i.unitCode &&
        i.ingredient.allowedUnits.includes(i.unitCode),
    ),
    cost = estimateShopping(data.items, today),
    text = shoppingText(data.items, today);
  const canGenerate = pantryReady && pantryAccountId === data.accountId;
  async function calculate() {
    const value = shoppingPreviewRequestSchema.safeParse({
      source,
      selections,
      inventory,
      today,
      expectedAccountId: data.accountId,
      includeOptional: optional,
    });
    if (!value.success) throw new Error("Alege 1–20 rețete și porții între 1 și 20.");
    const response = await fetch("/api/v1/shopping/preview", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value.data),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      throw new Error(body.error?.message ?? "Necesarul nu poate fi calculat.");
    }
    return shoppingPreviewSchema.parse(await response.json());
  }
  const shape = (rows: ShoppingItem[]) =>
    JSON.stringify(rows.map((i) => [i.ingredient?.id, i.quantity, i.unitCode, i.uncertain]));
  const focus = (e: Event) => {
    e.preventDefault();
    opener.current?.focus();
  };
  const open = (e: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    opener.current = e.currentTarget;
    setLocalError(null);
    action();
  };
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        {data.accountId
          ? "Listă sincronizată cu contul. Transferul creează loturi noi în frigider."
          : "Listă salvată în acest browser. Datele invitaților rămân separate de cont."}
      </p>
      <section
        className="space-y-4 rounded-2xl border border-border p-5"
        aria-labelledby="shopping-recipes"
      >
        <h2 id="shopping-recipes" className="font-display text-2xl">
          Din rețete
        </h2>
        {!data.recipes.length ? (
          <EmptyState
            compact
            title="Nu există rețete în această sursă"
            description="Poți adăuga manual sau explora exemplele demonstrative."
          />
        ) : (
          <>
            <label className="block space-y-2 text-sm">
              <span>Alege una sau mai multe rețete</span>
              <select
                multiple
                size={6}
                className={`${shoppingSelect} py-2`}
                value={selections.map((s) => s.slug)}
                onChange={(e) => {
                  setPreview(null);
                  setSelections(
                    Array.from(e.target.selectedOptions).map(
                      (o) =>
                        selections.find((s) => s.slug === o.value) ?? {
                          slug: o.value,
                          servings: data.recipes.find((r) => r.slug === o.value)!.servings,
                        },
                    ),
                  );
                }}
              >
                {data.recipes.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              Selectează împreună toate rețetele aceleiași runde de cumpărături. Pe desktop poți
              folosi Ctrl/Cmd pentru selecții multiple. Necesarul se adună înainte de a scădea
              stocul.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {selections.map((s) => (
                <TextField
                  key={s.slug}
                  label={`Porții ${data.recipes.find((r) => r.slug === s.slug)?.title ?? s.slug}`}
                  type="number"
                  min={1}
                  max={20}
                  value={s.servings}
                  onChange={(e) => {
                    setPreview(null);
                    setSelections((previous) =>
                      previous.map((p) =>
                        p.slug === s.slug ? { ...p, servings: Number(e.target.value) } : p,
                      ),
                    );
                  }}
                />
              ))}
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={optional}
                onChange={(e) => {
                  setOptional(e.target.checked);
                  setPreview(null);
                }}
              />
              Include ingredientele opționale
            </label>
            <Button
              disabled={!canGenerate || busy || !selections.length}
              loading={generating}
              onClick={async () => {
                setGenerating(true);
                setLocalError(null);
                try {
                  const result = await calculate();
                  setPreview({ ...result, context });
                } catch (e) {
                  setLocalError(e instanceof Error ? e.message : "Calcul indisponibil.");
                } finally {
                  setGenerating(false);
                }
              }}
            >
              Calculează lipsurile
            </Button>
            {!canGenerate && (
              <p role="status" className="text-sm text-muted-foreground">
                Verifică inventarul înainte de calcul. Reîncarcă frigiderul dacă sesiunea s-a
                schimbat.
              </p>
            )}
          </>
        )}
        {preview && preview.context === context && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Verifică necesarul înainte de adăugare</h3>
            <ul className="space-y-2 text-sm">
              {preview.explanations.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            {!preview.items.length ? (
              <p role="status">Stocul măsurat acoperă selecția. Nu adăugăm cantități zero.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {preview.items.map((i) => (
                    <li key={i.id}>
                      {i.label}: {i.quantity} {i.unitCode}
                      {i.uncertain ? " — verifică stocul necunoscut" : ""}
                    </li>
                  ))}
                </ul>
                <Button
                  disabled={busy || generating || !canGenerate}
                  onClick={async () => {
                    setGenerating(true);
                    setLocalError(null);
                    try {
                      const fresh = await calculate();
                      if (shape(fresh.items) !== shape(preview.items)) {
                        setPreview({ ...fresh, context });
                        setMessage(
                          "Stocul sau necesarul s-a schimbat. Revizuiește și confirmă din nou.",
                        );
                        return;
                      }
                      if (
                        await run({
                          kind: "append",
                          items: fresh.items.map((i) =>
                            shoppingInputSchema.parse({
                              id: i.id,
                              ingredientId: i.ingredient?.id ?? null,
                              label: i.label,
                              category: i.category,
                              quantity: i.quantity,
                              unitCode: i.unitCode,
                              checked: false,
                              price: null,
                              uncertain: i.uncertain,
                            }),
                          ),
                        })
                      ) {
                        setPreview(null);
                        setMessage("Necesarul a fost adăugat. Stocul nu a fost modificat.");
                      }
                    } catch (e) {
                      setLocalError(e instanceof Error ? e.message : "Adăugare indisponibilă.");
                    } finally {
                      setGenerating(false);
                    }
                  }}
                >
                  Confirmă adăugarea necesarului
                </Button>
              </>
            )}
          </div>
        )}
      </section>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={(e) => open(e, () => setEditor("new"))}>
          Adaugă manual
        </Button>
        <Button
          variant="outline"
          disabled={!data.items.length || busy}
          onClick={(e) => open(e, () => setShare(true))}
        >
          Partajează lista
        </Button>
        <Button
          variant="outline"
          disabled={!eligible.length || busy}
          onClick={(e) => open(e, () => setPurchase(true))}
        >
          Transferă cumpărăturile bifate
        </Button>
      </div>
      <section aria-labelledby="shopping-estimate" className="rounded-xl bg-muted p-5">
        <h2 id="shopping-estimate" className="font-semibold">
          Estimare din prețuri introduse
        </h2>
        <p className="mt-2 tabular-nums">
          {cost.subtotals.MDL} MDL · {cost.subtotals.RON} RON
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {cost.complete
            ? "Toate rândurile netransferate au un preț recent și compatibil."
            : `${cost.unknown} rânduri fără estimare sigură; acesta este doar subtotalul cunoscut.`}{" "}
          Prețurile pot varia. Nu convertim monedele; datele vechi de peste 30 zile, viitoare sau
          incompatibile sunt excluse.
        </p>
      </section>
      {!data.items.length ? (
        <EmptyState
          title="Lista este goală"
          description="Alege rețete sau adaugă un ingredient manual."
        />
      ) : (
        [...new Set(data.items.map((i) => i.category))]
          .sort((a, b) => a.localeCompare(b, "ro"))
          .map((category) => (
            <section key={category} className="space-y-3">
              <h2 className="font-display text-2xl">{category}</h2>
              <ul className="divide-y divide-border">
                {data.items
                  .filter((i) => i.category === category)
                  .map((i) => (
                    <li key={i.id} className="flex min-w-0 flex-wrap items-center gap-4 py-4">
                      <label className="flex min-w-0 flex-1 items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={busy || i.transferred}
                          checked={i.checked}
                          onChange={(e) => {
                            const { label, category, quantity, unitCode, price, uncertain } = i;
                            void run({
                              kind: "update",
                              id: i.id,
                              expectedRevision: i.revision,
                              fields: {
                                label,
                                category,
                                quantity,
                                unitCode,
                                price,
                                uncertain,
                                checked: e.target.checked,
                              },
                            });
                          }}
                        />
                        <span className="min-w-0 break-words">
                          <span className="block font-medium">{i.label}</span>
                          <span className="text-sm text-muted-foreground">
                            {i.quantity ?? "Cantitate de stabilit"} {i.unitCode ?? ""}
                            {i.transferred ? " · Transferat în frigider" : ""}
                            {i.uncertain ? " · Stoc necunoscut, verifică necesarul" : ""}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {i.price
                              ? `${i.price.amount} ${i.price.currency} / ${i.price.basisQuantity} ${i.price.basisUnit}, observat ${i.price.observedOn}`
                              : "Preț necunoscut"}
                            {!i.ingredient ? " · Text liber, fără transfer în frigider" : ""}
                          </span>
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {!i.transferred && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            aria-label={`Editează ${i.label}`}
                            onClick={(e) => open(e, () => setEditor(i))}
                          >
                            Editează
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          disabled={busy}
                          aria-label={`Elimină ${i.label}`}
                          onClick={() =>
                            void run({ kind: "remove", id: i.id, expectedRevision: i.revision })
                          }
                        >
                          Elimină
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {localError && !purchase && !share && (
        <p role="alert" className="text-sm text-danger-foreground">
          {localError}
        </p>
      )}
      <Dialog
        open={editor !== null}
        onOpenChange={(v) => {
          if (!v) setEditor(null);
        }}
      >
        <DialogContent
          title={editor === "new" ? "Adaugă un rând" : "Editează rândul"}
          description="Cantitățile și prețurile pot fi necunoscute. Alege identitatea canonică pentru transfer în frigider."
          onCloseAutoFocus={focus}
        >
          {editor && (
            <ItemForm
              key={editor === "new" ? "new" : editor.id}
              catalog={data.catalog}
              {...(editor === "new" ? {} : { item: editor })}
              busy={busy}
              today={today}
              onSave={run}
              onCancel={() => setEditor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={purchase} onOpenChange={setPurchase}>
        <DialogContent
          title="Confirmă transferul în frigider"
          description="Numai confirmarea de mai jos creează loturi. Bifarea și partajarea listei nu modifică inventarul. Pentru rândurile incerte, confirmă mai întâi cantitatea prin Editare."
          onCloseAutoFocus={focus}
        >
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                lines = eligible
                  .filter((i) => f.has(i.id))
                  .map((i) => ({
                    id: i.id,
                    expectedRevision: i.revision,
                    pantryItemId: crypto.randomUUID(),
                  }));
              if (!lines.length || lines.length > 50) {
                setLocalError("Alege între 1 și 50 rânduri pentru un transfer.");
                return;
              }
              if (
                await run({
                  kind: "purchase",
                  confirmed: true,
                  lines,
                  location: f.get("location") as "fridge" | "pantry" | "freezer",
                  expiresOn: String(f.get("expiresOn") ?? "") || null,
                })
              ) {
                setPurchase(false);
                setMessage("Cumpărăturile confirmate au fost transferate în loturi noi.");
                onRefreshPantry();
              }
            }}
          >
            <fieldset disabled={busy} className="space-y-3">
              <legend className="font-medium">Cantități revizuite pentru transfer</legend>
              {eligible.map((i) => (
                <label key={i.id} className="flex items-center gap-3 text-sm">
                  <input type="checkbox" name={i.id} defaultChecked={eligible.indexOf(i) < 50} />
                  {i.label}: {i.quantity} {i.unitCode}
                </label>
              ))}
              <label className="block space-y-2 text-sm">
                <span>Loc de depozitare</span>
                <select name="location" className={shoppingSelect} defaultValue="fridge">
                  <option value="fridge">Frigider</option>
                  <option value="pantry">Cămară</option>
                  <option value="freezer">Congelator</option>
                </select>
              </label>
              <TextField
                name="expiresOn"
                label="Data expirării (opțional)"
                type="date"
                min="1900-01-01"
              />
            </fieldset>
            {localError && (
              <p role="alert" className="text-sm text-danger-foreground">
                {localError}
              </p>
            )}
            <Button type="submit" loading={busy}>
              Confirmă cumpărăturile și transferul
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={share} onOpenChange={setShare}>
        <DialogContent
          title="Partajează lista"
          description="Revizuiește textul care va fi copiat sau trimis prin aplicația aleasă. Nu se creează un link public către cont."
          onCloseAutoFocus={focus}
        >
          <textarea
            className="min-h-64 w-full rounded-lg border bg-background p-3 text-sm"
            aria-label="Text de partajat"
            value={text}
            readOnly
          />
          {localError && (
            <p role="alert" className="text-sm text-danger-foreground">
              {localError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={async () => {
                try {
                  if (navigator.share) await navigator.share({ title: "Lista Cookly", text });
                  else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(text);
                    setMessage("Lista a fost copiată.");
                  } else throw new Error("Selectează textul și copiază-l manual.");
                } catch (e) {
                  if (e instanceof Error && e.name !== "AbortError") setLocalError(e.message);
                }
              }}
            >
              Trimite sau copiază textul
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
