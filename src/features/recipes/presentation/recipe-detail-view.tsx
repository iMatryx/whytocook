"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { localCalendarDay } from "@/shared/domain/expiry";
import { parseDetailQuery, recipeDetailHref } from "../contracts/detail-query";
import { recipeActionCommandSchema } from "../contracts/detail.schema";
import type { RecipeDetailResponse } from "../contracts/detail.schema";
import type { RecipeSearchRequest } from "../contracts/search.schema";
import { useRecipeDetail } from "./use-recipe-detail";
import { useRecipeActions } from "./use-recipe-actions";
import { CookingMode } from "./cooking-mode";
import { allergyOptions } from "./recipe-filters";
const equipmentNames: Record<string, string> = {
  hob: "Plită",
  oven: "Cuptor",
  microwave: "Cuptor cu microunde",
  pan: "Tigaie",
  pot: "Oală",
  knife: "Cuțit",
  mixing_bowl: "Bol",
  baking_tray: "Tavă",
  blender: "Blender",
  mixer: "Mixer",
  air_fryer: "Air fryer",
  grill: "Grătar",
  grater: "Răzătoare",
  strainer: "Strecurătoare",
  food_thermometer: "Termometru alimentar",
  rolling_pin: "Sucitor",
};
const labelAllergen = (code: string) => allergyOptions.find((o) => o.value === code)?.label ?? code;
type DetailProps = {
  slug: string;
  inventory: RecipeSearchRequest["inventory"];
  accountId: string | null;
  inventoryStatus: "loading" | "ready" | "error";
  inventoryError: string | null;
  onRetryInventory: () => void;
  onConsume: (slugs: string[]) => void;
  notice: string | null;
};
export function RecipeDetailView(props: DetailProps) {
  const params = useSearchParams(),
    query = params.toString(),
    router = useRouter();
  const parsed = useMemo(() => parseDetailQuery(new URLSearchParams(query)), [query]);
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setToday(localCalendarDay()),
      timer = setTimeout(update, 0),
      interval = setInterval(update, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);
  const request =
    parsed.success && today
      ? {
          ...parsed.data,
          slug: props.slug,
          inventory: props.inventory,
          today,
          expectedAccountId: props.accountId,
        }
      : null;
  const detail = useRecipeDetail(request, props.inventoryStatus === "ready");
  if (!parsed.success)
    return (
      <ErrorState
        title="Adresa rețetei nu este validă"
        description={parsed.message}
        onRetry={() =>
          router.replace(
            `/recipes/${props.slug}${params.get("source") === "demo" ? "?source=demo" : ""}`,
          )
        }
      />
    );
  const data = detail.data ?? detail.retainedData;
  const active = props.inventoryStatus === "ready" && detail.data !== null;
  return (
    <>
      {props.inventoryStatus === "error" ? (
        <ErrorState
          title="Inventarul nu poate fi încărcat"
          description={
            props.inventoryError ?? "Reîncearcă pentru a verifica ingredientele disponibile."
          }
          onRetry={props.onRetryInventory}
        />
      ) : detail.status === "error" ? (
        <div className="space-y-5">
          <h1 className="font-display text-4xl">Rețetă</h1>
          <ErrorState
            title={detail.notFound ? "Rețeta nu a fost găsită" : "Rețeta nu poate fi încărcată"}
            description={detail.error ?? "Reîncearcă."}
            onRetry={detail.reload}
          />
          <Button asChild variant="outline">
            <Link href={parsed.data.source === "demo" ? "/recipes?source=demo" : "/recipes"}>
              Înapoi la rețete
            </Link>
          </Button>
        </div>
      ) : !active ? (
        <div role="status" aria-label="Se încarcă rețeta" className="space-y-5">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      ) : null}
      {data && (
        <div hidden={!active} inert={!active}>
          <RecipeDetailContent
            key={`${data.source}:${data.recipe.key}:${data.recipe.revision}:${data.servings}:${data.accountId}:${data.blocked}`}
            data={data}
            active={active}
            query={parsed.data}
            onPortions={(servings) =>
              router.replace(recipeDetailHref(props.slug, { ...parsed.data, servings }), {
                scroll: false,
              })
            }
            onConsume={props.onConsume}
            notice={props.notice}
          />
        </div>
      )}
    </>
  );
}
function RecipeDetailContent({
  data,
  active,
  query,
  onPortions,
  onConsume,
  notice,
}: {
  data: RecipeDetailResponse;
  active: boolean;
  query: {
    source: "demo" | "published";
    servings: number | null;
    allergy: string[];
    exclude: string[];
  };
  onPortions: (n: number) => void;
  onConsume: (slugs: string[]) => void;
  notice: string | null;
}) {
  const actions = useRecipeActions(data, active),
    r = data.recipe;
  const [cooking, setCooking] = useState(false),
    [shopping, setShopping] = useState(false),
    [finish, setFinish] = useState(false),
    [photoFailed, setPhotoFailed] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [shoppingError, setShoppingError] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const missing = (data.compatibility?.ingredients ?? []).filter(
    (i) => !i.optional && Number(i.shortage) > 0,
  );
  const shownPhoto = data.metadata.photo && !photoFailed ? data.metadata.photo : null;
  function portions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const n = Number(new FormData(event.currentTarget).get("servings"));
    if (Number.isInteger(n) && n >= 1 && n <= 20) onPortions(n);
  }
  async function addShopping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const command = recipeActionCommandSchema.safeParse({
      kind: "shopping",
      items: missing
        .filter((i) => fields.has(`include:${i.ingredientSlug}`))
        .map((i) => ({
          ingredientSlug: i.ingredientSlug,
          label: r.ingredients.find((line) => line.ingredientSlug === i.ingredientSlug)!.name,
          quantity: String(fields.get(`quantity:${i.ingredientSlug}`) ?? ""),
          unitCode: i.unit,
        })),
    });
    if (!command.success || command.data.kind !== "shopping") {
      setShoppingError("Selectează 1–50 ingrediente și cantități pozitive în unitățile afișate.");
      return;
    }
    const error = await actions.run(command.data);
    if (error) {
      setShoppingError(error);
      return;
    }
    setShopping(false);
    setMessage(
      `${command.data.items.length} ingrediente adăugate în lista de cumpărături. Inventarul nu a fost modificat.`,
    );
  }
  const closeFocus = (event: Event) => {
    event.preventDefault();
    opener.current?.focus();
  };
  return (
    <div className="space-y-8">
      <Link
        className="inline-block rounded-sm text-sm underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={data.source === "demo" ? "/recipes?source=demo" : "/recipes"}
      >
        Înapoi la rețete
      </Link>
      {data.source === "demo" && (
        <p className="rounded-xl bg-warning px-5 py-4 text-sm text-warning-foreground">
          Rețetă demonstrativă, netestată practic. Fotografiile ilustrative, timpii și cantitățile
          nu reprezintă o verificare culinară.
        </p>
      )}
      <header>
        <h1 className="max-w-3xl font-display text-4xl leading-tight sm:text-5xl">{r.title}</h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{r.summary}</p>
        <ul aria-label="Detalii rețetă" className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>{r.totalMinutes} minute</li>
          <li>{data.servings} porții</li>
          <li>
            {r.difficulty === "easy" ? "Ușoară" : r.difficulty === "medium" ? "Medie" : "Dificilă"}
          </li>
          <li>
            {data.compatibility
              ? `Compatibilitate ${data.compatibility.score}/100`
              : "Compatibilitate indisponibilă"}
          </li>
        </ul>
      </header>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <figure className="min-w-0">
          <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-muted">
            {shownPhoto ? (
              <Image
                src={shownPhoto.url}
                alt={shownPhoto.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                unoptimized={!shownPhoto.url.startsWith("/")}
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
                <p>
                  {photoFailed
                    ? "Fotografia nu poate fi afișată."
                    : "Nu este disponibilă o fotografie pentru această rețetă."}
                </p>
              </div>
            )}
          </div>
          {shownPhoto && (
            <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {shownPhoto.credit}
            </figcaption>
          )}
        </figure>
        <section
          className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
          aria-labelledby="recipe-actions"
        >
          <h2 id="recipe-actions" className="font-display text-2xl">
            Pregătește masa
          </h2>
          <form onSubmit={portions} className="flex flex-wrap items-end gap-3">
            <TextField
              key={data.servings}
              name="servings"
              type="number"
              min="1"
              max="20"
              label="Porții"
              defaultValue={data.servings}
            />
            <Button variant="outline" type="submit">
              Ajustează porțiile
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Bucățile și cantitățile nereprezentabile exact sunt rotunjite în sus. Schimbarea
            porțiilor nu modifică inventarul.
          </p>
          {data.blocked && (
            <p role="alert" className="rounded-lg bg-danger p-4 text-sm text-danger-foreground">
              {data.blockReason}
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            disabled={data.blocked}
            onClick={(e) => {
              opener.current = e.currentTarget;
              setCooking(true);
            }}
          >
            Începe Cooking
          </Button>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={!actions.ready || actions.busy}
              aria-pressed={actions.favorite}
              onClick={async () => {
                const error = await actions.run({ kind: "favorite", enabled: !actions.favorite });
                if (!error)
                  setMessage(
                    actions.favorite
                      ? "Rețetă eliminată din favorite."
                      : "Rețetă salvată în favorite.",
                  );
              }}
            >
              {actions.favorite ? "Elimină din favorite" : "Adaugă la favorite"}
            </Button>
            <Button
              variant="outline"
              disabled={!actions.ready || actions.busy || data.blocked || !missing.length}
              onClick={(e) => {
                opener.current = e.currentTarget;
                setShoppingError(null);
                setShopping(true);
              }}
            >
              Adaugă lipsurile în lista de cumpărături
            </Button>
            <Button
              variant="outline"
              disabled={!actions.ready || actions.busy || data.blocked}
              onClick={(e) => {
                opener.current = e.currentTarget;
                setFinish(true);
              }}
            >
              Am gătit
            </Button>
          </div>
          {!missing.length && (
            <p className="text-xs text-muted-foreground">
              Nu există lipsuri măsurabile de adăugat automat în listă.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {actions.label}. Favoritele și cumpărăturile nu scad cantități.
          </p>
          {actions.lastCookedAt && (
            <p className="text-sm">
              Ultima marcare ca gătită:{" "}
              <time dateTime={actions.lastCookedAt}>
                {new Date(actions.lastCookedAt).toLocaleString("ro-RO")}
              </time>
            </p>
          )}
          {actions.error && (
            <p role="alert" className="text-sm text-danger-foreground">
              {actions.error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-success-foreground">
              {message}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-success-foreground">
              {notice}
            </p>
          )}
        </section>
      </div>
      <section aria-labelledby="recipe-ingredients">
        <h2 id="recipe-ingredients" className="font-display text-3xl">
          Ingrediente pentru {data.servings} porții
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Disponibilul reprezintă stocul măsurat. Cantitățile necunoscute trebuie verificate înainte
          de cumpărături sau consum.
        </p>
        <ul className="mt-5 divide-y divide-border">
          {r.ingredients.map((line, index) => {
            const scaled = data.scaledIngredients[index],
              match = data.compatibility?.ingredients.find(
                (i) => i.ingredientSlug === line.ingredientSlug,
              );
            return (
              <li
                key={`${line.ingredientSlug}:${index}`}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div>
                  <h3 className="font-medium">
                    {line.name}
                    {line.optional ? " (opțional)" : ""}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scaled?.quantity ?? line.quantity} {scaled?.unitCode ?? line.unit}
                    {scaled?.rounded ? " — rotunjit în sus" : ""}
                    {scaled?.quantity === null ? " — unitate nesuportată pentru scalare" : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{line.preparation}</p>
                </div>
                <div className="text-sm">
                  {match ? (
                    <>
                      <Badge tone={match.status === "sufficient" ? "success" : "neutral"}>
                        {match.status === "sufficient"
                          ? "Disponibil"
                          : match.status === "insufficient"
                            ? "Cantitate insuficientă"
                            : match.status === "unknown_quantity"
                              ? "Cantitate necunoscută"
                              : "Lipsește"}
                      </Badge>
                      <p className="mt-2">
                        Disponibil: {match.available} {match.unit}
                      </p>
                      {Number(match.shortage) > 0 && (
                        <p>
                          Deficit măsurat: {match.shortage} {match.unit}
                        </p>
                      )}
                      {match.uncertain && (
                        <p className="mt-1 text-muted-foreground">
                          Mai există cantități nemăsurate.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Compatibilitate indisponibilă</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="grid gap-7 lg:grid-cols-2">
        <section
          className="rounded-2xl border border-border p-5"
          aria-labelledby="recipe-nutrition"
        >
          <h2 id="recipe-nutrition" className="font-display text-2xl">
            Nutriție per porție
          </h2>
          {data.metadata.nutrition.perServing ? (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {Object.entries(data.metadata.nutrition.perServing).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">
                      {
                        {
                          energyKcal: "Energie (kcal)",
                          proteinG: "Proteine (g)",
                          carbohydrateG: "Carbohidrați (g)",
                          fatG: "Grăsimi (g)",
                          fiberG: "Fibre (g)",
                          saltG: "Sare (g)",
                        }[key]
                      }
                    </dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {data.metadata.nutrition.source && (
                <p className="mt-4 text-sm">
                  Sursa:{" "}
                  <a
                    className="underline"
                    href={data.metadata.nutrition.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {data.metadata.nutrition.source.name}
                  </a>{" "}
                  · {data.metadata.nutrition.source.recordId}
                </p>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Date nutritive și sursă indisponibile. Necunoscut nu înseamnă zero.
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-border p-5">
          <h2 className="font-display text-2xl">Alergeni și echipament</h2>
          <p className="mt-4 text-sm">
            Statut alergeni: {r.allergens.status === "verified" ? "verificat" : "neverificat"}.
          </p>
          <p className="mt-2 text-sm">
            Conține:{" "}
            {r.allergens.contains.map(labelAllergen).join(", ") || "nicio declarație disponibilă"}.
          </p>
          <p className="mt-2 text-sm">
            Poate conține:{" "}
            {r.allergens.mayContain.map(labelAllergen).join(", ") || "nicio declarație disponibilă"}
            .
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Lipsa declarațiilor nu garantează absența alergenilor. Verifică etichetele produselor.
          </p>
          <h3 className="mt-5 font-semibold">Echipament necesar</h3>
          <p className="mt-2 text-sm">
            {r.equipment
              .map((code) => equipmentNames[code] ?? code.replaceAll("_", " "))
              .join(", ") || "Nespecificat"}
          </p>
        </section>
      </div>
      <section aria-labelledby="recipe-steps">
        <h2 id="recipe-steps" className="font-display text-3xl">
          Instrucțiuni
        </h2>
        <ol className="mt-5 list-decimal space-y-5 pl-6 leading-relaxed">
          {r.steps.map((instruction, index) => (
            <li key={index} className="pl-2">
              {instruction}
              {data.metadata.stepTimers[index] !== null && (
                <span className="mt-1 block text-sm text-muted-foreground">
                  Cronometru recomandat: {data.metadata.stepTimers[index]} secunde
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="recipe-similar">
        <h2 id="recipe-similar" className="font-display text-3xl">
          Rețete similare
        </h2>
        {!data.similar.length ? (
          <EmptyState
            compact
            title="Nu avem alte sugestii pentru aceste restricții"
            description="Nu schimbăm ingredientele sau restricțiile pentru a forța o recomandare."
          />
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {data.similar.map((recipe) => (
              <li key={recipe.key} className="rounded-xl border border-border p-5">
                <Link
                  className="rounded-sm font-display text-xl underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={recipeDetailHref(recipe.key, query)}
                >
                  {recipe.title}
                </Link>
                <p className="mt-2 text-sm text-muted-foreground">
                  {recipe.totalMinutes} minute · {recipe.servings} porții de bază
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {cooking && (
        <CookingMode
          visible={active && !data.blocked}
          title={r.title}
          steps={r.steps}
          timers={data.metadata.stepTimers}
          sessionKey={`cookly-cooking-v1:${data.accountId ?? "guest"}:${data.source}:${r.key}:${r.revision}:${data.servings}`}
          onClose={() => {
            setCooking(false);
            setTimeout(() => opener.current?.focus(), 0);
          }}
          onFinish={() => {
            setCooking(false);
            setFinish(true);
          }}
        />
      )}
      <Dialog open={shopping && active && !data.blocked} onOpenChange={setShopping}>
        <DialogContent
          title="Verifică lista de cumpărături"
          description="Ajustează deficitul măsurat înainte de confirmare. Cantitățile nemăsurate din inventar pot schimba necesarul."
          onCloseAutoFocus={closeFocus}
        >
          <form onSubmit={addShopping} className="space-y-5">
            <fieldset disabled={actions.busy} className="space-y-4">
              <legend className="sr-only">Ingrediente de cumpărat</legend>
              {missing.map((i) => (
                <div key={i.ingredientSlug}>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" name={`include:${i.ingredientSlug}`} defaultChecked />
                    {r.ingredients.find((line) => line.ingredientSlug === i.ingredientSlug)?.name} (
                    {i.unit})
                  </label>
                  <TextField
                    label={`Cantitate de cumpărat ${i.ingredientSlug}`}
                    name={`quantity:${i.ingredientSlug}`}
                    type="number"
                    min={i.unit === "piece" ? "1" : "0.000001"}
                    step={i.unit === "piece" ? "1" : "0.000001"}
                    defaultValue={i.shortage}
                  />
                  {i.uncertain && (
                    <p className="mt-1 text-xs text-warning-foreground">
                      Există stoc nemăsurat; verifică înainte de a cumpăra.
                    </p>
                  )}
                </div>
              ))}
            </fieldset>
            {shoppingError && (
              <p role="alert" className="text-sm text-danger-foreground">
                {shoppingError}
              </p>
            )}
            <Button type="submit" loading={actions.busy}>
              Confirmă adăugarea în listă
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={finish && active && !data.blocked} onOpenChange={setFinish}>
        <DialogContent
          title="Ai terminat de gătit?"
          description="Marcarea rețetei și scăderea ingredientelor sunt acțiuni separate. Nimic nu se scade automat."
          onCloseAutoFocus={closeFocus}
        >
          <div className="space-y-4">
            <Button
              disabled={!actions.ready || actions.busy}
              onClick={async () => {
                const error = await actions.run({ kind: "cooked", servings: data.servings });
                if (!error) {
                  setFinish(false);
                  setMessage("Rețetă marcată ca gătită. Inventarul nu a fost modificat.");
                }
              }}
            >
              Confirmă: am gătit, fără scăderea stocului
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFinish(false);
                onConsume(r.ingredients.map((i) => i.ingredientSlug));
              }}
            >
              Revizuiește consumul din inventar
            </Button>
            <p className="text-sm text-muted-foreground">
              Revizuirea consumului cere alegerea loturilor, preview și confirmare explicită în My
              Fridge.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
