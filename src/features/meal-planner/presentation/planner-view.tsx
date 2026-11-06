"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { localCalendarDay } from "@/shared/domain/expiry";
import {
  addPlannerDays,
  plannerMonday,
  plannerShoppingFingerprint,
  nutrientKeys,
} from "@/shared/domain/meal-planner";
import { plannerDay, plannerBudgetSchema } from "../contracts";
import type { PlannerBootstrap, PlannerEntry, PlannerAnalysis, PlannerCommand } from "../contracts";
import type { RecipeSearchRequest } from "@/features/recipes/contracts";
import { usePlanner, fetchPlannerAnalysis } from "./use-planner";
import type { LocalPlannerPort } from "./use-planner";
import { MealForm, slotLabels, plannerSelect } from "./meal-form";
type Props = {
  local: LocalPlannerPort;
  inventory: RecipeSearchRequest["inventory"];
  pantryReady: boolean;
  pantryAccountId: string | null;
};
const nutrientNames = {
  energyKcal: "Energie (kcal)",
  proteinG: "Proteine (g)",
  carbohydrateG: "Carbohidrați (g)",
  fatG: "Grăsimi (g)",
  fiberG: "Fibre (g)",
  saltG: "Sare (g)",
};
export function PlannerView(props: Props) {
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
  return today ? (
    <PlannerReady {...props} today={today} />
  ) : (
    <p role="status">Se încarcă datele calendarului…</p>
  );
}
function PlannerReady(props: Props & { today: string }) {
  const params = useSearchParams(),
    router = useRouter(),
    source = params.get("source") === "demo" ? "demo" : "published",
    parsed = plannerDay.safeParse(params.get("startsOn") ?? plannerMonday(props.today)),
    startsOn = parsed.success ? parsed.data : plannerMonday(props.today),
    planner = usePlanner(startsOn, source, props.local);
  const href = (day: string, nextSource = source) =>
    `/meal-planner?startsOn=${day}${nextSource === "demo" ? "&source=demo" : ""}`;
  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-4xl">Mesele următoarelor 7 zile</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Planifică porțiile, pregătirea în avans și cumpărăturile. O masă planificată nu este
          marcată ca preparată și nu scade inventarul.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          aria-pressed={source === "published"}
          onClick={() => router.replace(href(startsOn, "published"))}
        >
          Rețete publicate
        </Button>
        <Button
          variant="outline"
          aria-pressed={source === "demo"}
          onClick={() => router.replace(href(startsOn, "demo"))}
        >
          Demo pentru invitați
        </Button>
        <Button asChild variant="outline">
          <Link href={`/shopping-list${source === "demo" ? "?source=demo" : ""}`}>
            Lista de cumpărături
          </Link>
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const day = String(new FormData(e.currentTarget).get("startsOn"));
          if (plannerDay.safeParse(day).success) router.replace(href(day));
        }}
      >
        <TextField
          key={startsOn}
          name="startsOn"
          label="Săptămâna începe la"
          type="date"
          min="1900-01-01"
          max="9999-12-25"
          defaultValue={startsOn}
          required
        />
        <Button variant="outline" type="submit">
          Deschide săptămâna
        </Button>
        <Button
          variant="ghost"
          type="button"
          disabled={startsOn < "1900-01-08"}
          onClick={() => router.replace(href(addPlannerDays(startsOn, -7)))}
        >
          Săptămâna anterioară
        </Button>
        <Button
          variant="ghost"
          type="button"
          disabled={startsOn > "9999-12-18"}
          onClick={() => router.replace(href(addPlannerDays(startsOn, 7)))}
        >
          Săptămâna următoare
        </Button>
      </form>
      {!parsed.success ? (
        <ErrorState
          title="Data săptămânii nu este validă"
          description="Alege o dată calendaristică validă pentru începutul celor 7 zile."
          onRetry={() => router.replace(href(plannerMonday(props.today)))}
        />
      ) : (
        <>
          {source === "demo" && (
            <p className="rounded-xl bg-warning p-4 text-sm text-warning-foreground">
              Rețete demonstrative, netestate practic. Nutriția și costurile necunoscute rămân
              necunoscute. Modul demo se păstrează local pentru invitați.
            </p>
          )}
          {planner.error && (
            <ErrorState
              title="Plannerul nu poate fi confirmat"
              description={planner.error}
              onRetry={() => void planner.reload()}
            />
          )}
          {!planner.data && !planner.error && (
            <p role="status">Se încarcă săptămâna și rețetele…</p>
          )}
          {planner.data && (
            <PlannerContent
              key={`${startsOn}:${source}:${planner.data.accountId}`}
              {...props}
              data={planner.data}
              source={source}
              busy={planner.busy}
              save={planner.save}
              exportWeek={planner.exportWeek}
              reload={() => void planner.reload()}
              onCopy={(day) => router.replace(href(day))}
            />
          )}
        </>
      )}
    </div>
  );
}
function PlannerContent({
  data,
  source,
  today,
  inventory,
  pantryReady,
  pantryAccountId,
  busy,
  save,
  exportWeek,
  reload,
  onCopy,
}: {
  data: PlannerBootstrap;
  source: "demo" | "published";
  today: string;
  busy: boolean;
  save: (c: PlannerCommand) => Promise<boolean>;
  exportWeek: (
    body: Record<string, unknown>,
    items: PlannerAnalysis["shopping"],
    current: () => boolean,
  ) => Promise<boolean>;
  reload: () => void;
  onCopy: (day: string) => void;
} & Props & { today: string }) {
  const [editor, setEditor] = useState<{
      day: string;
      slot: PlannerEntry["slot"];
      entry?: PlannerEntry;
    } | null>(null),
    [configure, setConfigure] = useState(false),
    [copy, setCopy] = useState(false),
    [preview, setPreview] = useState<{ signature: string; analysis: PlannerAnalysis } | null>(null),
    [message, setMessage] = useState<string | null>(null),
    [localError, setLocalError] = useState<string | null>(null),
    [exportBusy, setExportBusy] = useState(false),
    [analysis, setAnalysis] = useState<{
      signature: string;
      data: PlannerAnalysis | null;
      error: string | null;
    }>({ signature: "", data: null, error: null });
  const confirmationScope = useRef<{ active: boolean } | null>(null),
    opener = useRef<HTMLButtonElement | null>(null),
    request = {
      source,
      startsOn: data.week.startsOn,
      week: data.week,
      expectedAccountId: data.accountId,
      inventory,
      today,
    },
    signature = JSON.stringify(request),
    ready = pantryReady && pantryAccountId === data.accountId;
  useEffect(() => {
    const scope = { active: true };
    confirmationScope.current = scope;
    return () => {
      scope.active = false;
    };
  }, [signature, ready]);
  useEffect(() => {
    if (!ready) return;
    let current = true;
    const timer = setTimeout(() => {
      setAnalysis({ signature, data: null, error: null });
      void fetchPlannerAnalysis(JSON.parse(signature) as Record<string, unknown>)
        .then((result) => {
          if (current) {
            if (result.accountId !== data.accountId || result.week.revision !== data.week.revision)
              throw new Error("Planul s-a schimbat. Reîncarcă săptămâna.");
            setAnalysis({ signature, data: result.analysis, error: null });
          }
        })
        .catch((e) => {
          if (current)
            setAnalysis({
              signature,
              data: null,
              error:
                e instanceof Error && e.name !== "ZodError"
                  ? e.message
                  : "Calculele nu sunt disponibile.",
            });
        });
    }, 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [signature, ready, data.accountId, data.week.revision]);
  const a = ready && analysis.signature === signature ? analysis.data : null,
    analysisError = ready && analysis.signature === signature ? analysis.error : null;
  const open = (e: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
      opener.current = e.currentTarget;
      setLocalError(null);
      action();
    },
    focus = (e: Event) => {
      e.preventDefault();
      opener.current?.focus();
    };
  let nextWeek = "";
  try {
    nextWeek = addPlannerDays(data.week.startsOn, 7);
  } catch {}
  return (
    <div className="space-y-7">
      <p className="text-sm text-muted-foreground">
        {data.accountId
          ? "Plan salvat în cont. Sunt folosite versiunile publicate selectate."
          : "Plan salvat în acest browser, separat de datele contului."}{" "}
        Inventarul este doar alocat virtual pentru această săptămână.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={busy}
          onClick={(e) => open(e, () => setConfigure(true))}
        >
          Buget maxim
        </Button>
        <Button
          variant="outline"
          disabled={busy || data.week.revision === "0"}
          onClick={(e) => open(e, () => setCopy(true))}
        >
          Copiază săptămâna
        </Button>
        <Button
          disabled={busy || !a?.complete || data.week.revision === "0" || a.shopping.length > 100}
          onClick={(e) => open(e, () => setPreview({ signature, analysis: a! }))}
        >
          Generează lista consolidată
        </Button>
      </div>
      {data.week.exportedRevision && (
        <p className="rounded-lg bg-muted p-4 text-sm">
          {data.week.exportedRevision === data.week.revision
            ? "Această revizie a planului a fost exportată. O nouă confirmare înlocuiește doar rândurile generate nemodificate."
            : "Planul s-a modificat după ultimul export. Lista existentă nu a fost rescrisă; revizuiește și regenerează explicit."}
        </p>
      )}
      {!data.recipes.length && (
        <EmptyState
          compact
          title="Nu sunt rețete disponibile pentru plan"
          description="Verifică sursa și restricțiile profilului. Poți modifica bugetul sau elimina mesele indisponibile."
        />
      )}
      {!data.week.entries.length && (
        <EmptyState
          compact
          title="Săptămâna nu conține mese"
          description="Adaugă o rețetă la mic dejun, prânz, cină sau gustări. Porțiile și necesarul se recalculează după salvare."
        />
      )}
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => {
          const day = addPlannerDays(data.week.startsOn, index);
          return (
            <section
              key={day}
              aria-label={`Mese ${day}`}
              className="min-w-0 rounded-2xl border border-border p-3"
            >
              <h2 className="mb-4 break-words font-display text-xl">
                <time dateTime={day}>
                  {new Intl.DateTimeFormat("ro-RO", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(day + "T12:00:00Z"))}
                </time>
              </h2>
              {(Object.entries(slotLabels) as [PlannerEntry["slot"], string][]).map(
                ([slot, label]) => (
                  <div key={slot} className="space-y-3 border-t border-border py-4">
                    <h3 className="text-sm font-semibold">{label}</h3>
                    <ul className="space-y-4">
                      {data.week.entries
                        .filter((e) => e.plannedOn === day && e.slot === slot)
                        .map((entry) => {
                          const r = data.recipes.find(
                            (r) =>
                              r.key === entry.recipeKey &&
                              r.revision === entry.recipeRevision &&
                              r.versionId === entry.versionId,
                          );
                          return (
                            <li key={entry.id} className="min-w-0 space-y-2 text-sm">
                              {r ? (
                                <Link
                                  className="block break-words underline underline-offset-4"
                                  href={`/recipes/${r.key}${source === "demo" ? "?source=demo&" : "?"}servings=${entry.servings}`}
                                >
                                  {r.title}
                                </Link>
                              ) : (
                                <p className="break-words text-warning-foreground">
                                  {entry.recipeKey.replaceAll("-", " ")} — versiune indisponibilă
                                </p>
                              )}
                              <p>{entry.servings} porții</p>
                              {entry.prepOn && (
                                <p className="text-xs text-muted-foreground">
                                  Pregătire: {entry.prepOn}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-auto min-h-9 whitespace-normal"
                                  disabled={busy}
                                  aria-label={`Editează ${r?.title ?? entry.recipeKey} ${day} ${label}`}
                                  onClick={(e) => open(e, () => setEditor({ day, slot, entry }))}
                                >
                                  Editează / mută
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  aria-label={`Elimină ${r?.title ?? entry.recipeKey} ${day} ${label}`}
                                  onClick={() => void save({ kind: "removeEntry", id: entry.id })}
                                >
                                  Elimină
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-auto min-h-9 max-w-full whitespace-normal"
                      disabled={busy || !data.recipes.length || data.week.entries.length >= 56}
                      aria-label={`Adaugă ${label} ${day}`}
                      onClick={(e) => open(e, () => setEditor({ day, slot }))}
                    >
                      Adaugă masă
                    </Button>
                  </div>
                ),
              )}
            </section>
          );
        })}
      </div>
      {analysisError && (
        <ErrorState
          title="Calculele săptămânii nu sunt disponibile"
          description={analysisError}
          onRetry={reload}
        />
      )}
      {!a && !analysisError && (
        <p role="status">Se verifică planul și inventarul pentru calcule…</p>
      )}
      {a && (
        <>
          <section className="space-y-4 rounded-xl bg-muted p-5" aria-labelledby="planner-budget">
            <h2 id="planner-budget" className="font-display text-2xl">
              Bugetul săptămânii
            </h2>
            <p>
              Cost cunoscut: {a.budget.subtotals.MDL} MDL · {a.budget.subtotals.RON} RON
            </p>
            <p>
              {data.week.budget
                ? `Plafon de referință: ${data.week.budget.amount} ${data.week.budget.currency}`
                : "Nu ai stabilit un buget maxim."}
            </p>
            <p
              role="status"
              className={
                a.budget.state === "exceeded"
                  ? "font-semibold text-danger-foreground"
                  : "text-sm text-muted-foreground"
              }
            >
              {
                {
                  none: "Prețurile sunt estimări, monedele rămân separate.",
                  within: "Costul cunoscut complet este în limita bugetului.",
                  exceeded: "Costul cunoscut depășește bugetul maxim.",
                  unverifiable:
                    "Nu putem confirma respectarea bugetului: există costuri necunoscute, vechi sau în altă monedă.",
                }[a.budget.state]
              }
            </p>
            <p className="text-sm text-muted-foreground">
              {a.budget.unknownMeals} mese fără cost comparabil sigur. Prețurile introduse sau
              verificate sunt folosite maximum 30 zile; nu se fac conversii valutare. Plafonul
              semnalează depășiri și permite revizuirea planului.
            </p>
          </section>
          <section aria-labelledby="planner-nutrition" className="space-y-4">
            <h2 id="planner-nutrition" className="font-display text-2xl">
              Nutriție pentru toate porțiile planificate
            </h2>
            <p className="text-sm text-muted-foreground">
              Subtotal verificat; {a.unknownNutritionMeals} mese au date nutritive necunoscute sau
              rețete indisponibile. Lipsa datelor nu reprezintă zero și acest total nu este un aport
              zilnic per persoană.
            </p>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {nutrientKeys.map((k) => (
                <div key={k} className="rounded-lg border p-4">
                  <dt className="text-sm text-muted-foreground">{nutrientNames[k]}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">{a.nutrients[k]}</dd>
                </div>
              ))}
            </dl>
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer font-medium">Totaluri zilnice și surse</summary>
              <ul className="mt-4 space-y-3 text-sm">
                {a.days.map((d) => (
                  <li key={d.date}>
                    {d.date}:{" "}
                    {d.entryCount
                      ? `${d.nutrients.energyKcal} kcal și ${d.nutrients.proteinG} g proteine cunoscute; ${d.unknownMeals} mese necunoscute`
                      : "nicio masă planificată"}
                    <details>
                      <summary>Toți nutrienții</summary>
                      {nutrientKeys.map((k) => (
                        <p key={k}>
                          {nutrientNames[k]}: {d.nutrients[k]}
                        </p>
                      ))}
                    </details>
                  </li>
                ))}
              </ul>
              <ul className="mt-4 space-y-2 text-sm">
                {data.recipes
                  .filter(
                    (r) =>
                      data.week.entries.some((e) => e.recipeKey === r.key) &&
                      r.fullNutrition.source,
                  )
                  .map((r) => (
                    <li key={r.key}>
                      {r.title}:{" "}
                      <a
                        className="underline"
                        href={r.fullNutrition.source!.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {r.fullNutrition.source!.name}
                      </a>
                    </li>
                  ))}
              </ul>
            </details>
          </section>
          <section className="space-y-4" aria-labelledby="planner-stock">
            <h2 id="planner-stock" className="font-display text-2xl">
              Ingrediente și resurse comune
            </h2>
            <p className="text-sm text-muted-foreground">
              Se folosesc întâi loturile cu expirare mai apropiată, numai dacă sunt valabile la data
              mesei sau a pregătirii. Același stoc nu acoperă două mese. Sunt estimări pe inventarul
              curent, fără rezervare sau consum.
            </p>
            {a.warnings.length > 0 && (
              <ul role="alert" className="space-y-2 text-sm text-warning-foreground">
                {a.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {a.resources.some((r) => r.overlap) && (
              <p role="status" className="font-medium text-warning-foreground">
                Există mese care concurează pentru aceleași resurse din inventar.
              </p>
            )}
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer font-medium">
                Necesar total și deficit pentru {a.ingredients.length} grupe de ingrediente
              </summary>
              <ul className="mt-4 space-y-3 text-sm">
                {a.ingredients.map((i) => (
                  <li key={`${i.ingredientSlug}:${i.unit}`}>
                    <strong>{i.name}</strong>: necesar {i.required} {i.unit}, alocat {i.allocated},
                    de cumpărat {i.shortage}
                    {i.uncertain ? " — stoc necunoscut de verificat" : ""}
                  </li>
                ))}
              </ul>
            </details>
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer font-medium">
                Deficite pe mese și suprapuneri
              </summary>
              <ul className="mt-4 space-y-3 text-sm">
                {a.resources
                  .filter((r) => r.shortage !== "0")
                  .map((r, i) => (
                    <li key={i}>
                      {data.week.entries.find((e) => e.id === r.entryId)?.plannedOn} · {r.name}:
                      lipsesc {r.shortage} {r.unit}
                      {r.overlap ? "; o parte a stocului este deja alocată altor mese" : ""}
                    </li>
                  ))}
              </ul>
            </details>
          </section>
          <section className="space-y-3" aria-labelledby="planner-prep">
            <h2 id="planner-prep" className="font-display text-2xl">
              Pregătire în avans
            </h2>
            {!a.prepGroups.length ? (
              <p className="text-sm text-muted-foreground">
                Adaugă o dată de pregătire în editorul mesei pentru a grupa porțiile.
              </p>
            ) : (
              <ul className="space-y-3">
                {a.prepGroups.map((g, i) => (
                  <li key={i} className="rounded-xl border p-4">
                    <strong>
                      {g.prepOn} · {g.title}
                    </strong>
                    <p className="mt-2 text-sm">
                      {g.servings} porții pentru {g.entryIds.length} mese. Gruparea nu marchează
                      prepararea și nu modifică stocul.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {localError && !preview && !copy && !configure && (
        <p role="alert" className="text-danger-foreground">
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
          title={editor?.entry ? "Editează sau mută masa" : "Adaugă o masă"}
          description="Planificarea este independentă de istoricul preparărilor. Schimbă data sau slotul pentru a muta masa."
          onCloseAutoFocus={focus}
        >
          {editor && (
            <MealForm
              data={data}
              {...(editor.entry ? { entry: editor.entry } : {})}
              day={editor.day}
              slot={editor.slot}
              today={today}
              busy={busy}
              onSave={save}
              onClose={() => setEditor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={configure} onOpenChange={setConfigure}>
        <DialogContent
          title="Buget maxim pentru 7 zile"
          description="Plafon de referință, cu costuri necunoscute semnalate separat. Lasă suma goală pentru a elimina plafonul."
          onCloseAutoFocus={focus}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                amount = String(f.get("amount") ?? "").trim(),
                parsed = amount
                  ? plannerBudgetSchema.safeParse({ amount, currency: f.get("currency") })
                  : { success: true as const, data: null };
              if (!parsed.success) {
                setLocalError("Introdu o sumă cu maximum două zecimale.");
                return;
              }
              if (await save({ kind: "configure", budget: parsed.data })) {
                setConfigure(false);
                setMessage("Bugetul a fost actualizat.");
              }
            }}
          >
            <TextField
              name="amount"
              label="Buget maxim"
              inputMode="decimal"
              defaultValue={data.week.budget?.amount ?? ""}
            />
            <label className="block space-y-2 text-sm">
              <span>Moneda bugetului</span>
              <select
                name="currency"
                className={plannerSelect}
                defaultValue={data.week.budget?.currency ?? "MDL"}
              >
                <option>MDL</option>
                <option>RON</option>
              </select>
            </label>
            {localError && <p role="alert">{localError}</p>}
            <Button loading={busy} type="submit">
              Salvează bugetul
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={copy} onOpenChange={setCopy}>
        <DialogContent
          title="Copiază săptămâna"
          description="Sursa rămâne intactă. Ținta trebuie să nu conțină un plan salvat; nu suprascriem alte mese."
          onCloseAutoFocus={focus}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const target = String(new FormData(e.currentTarget).get("target"));
              if (!plannerDay.safeParse(target).success) {
                setLocalError("Alege o dată validă.");
                return;
              }
              if (await save({ kind: "copyWeek", targetStartsOn: target })) {
                setCopy(false);
                onCopy(target);
              }
            }}
          >
            <TextField
              name="target"
              label="Începutul săptămânii țintă"
              type="date"
              min="1900-01-01"
              max="9999-12-25"
              defaultValue={nextWeek}
              required
            />
            {localError && <p role="alert">{localError}</p>}
            <Button loading={busy} type="submit">
              Confirmă copierea
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!preview && preview.signature === signature && !!a}
        onOpenChange={(v) => {
          if (!v) setPreview(null);
        }}
      >
        <DialogContent
          title="Lista consolidată a săptămânii"
          description="Revizuiește deficitul. Confirmarea înlocuiește doar rândurile generate anterior nemodificate și nebifate; păstrează cumpărăturile transferate și rândurile manuale. Nu scade inventarul."
          onCloseAutoFocus={focus}
        >
          {preview && (
            <div className="space-y-4">
              {!preview.analysis.shopping.length ? (
                <p>
                  Nu sunt ingrediente de cumpărat după alocarea stocului măsurat. Exportul poate
                  curăța necesarul anterior nemodificat.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {preview.analysis.shopping.map((i) => (
                    <li key={i.id}>
                      {i.label}: {i.quantity} {i.unitCode}
                      {i.uncertain ? " — verifică stocul necunoscut" : ""}
                    </li>
                  ))}
                </ul>
              )}
              {localError && (
                <p role="alert" className="text-danger-foreground">
                  {localError}
                </p>
              )}
              <Button
                loading={busy || exportBusy}
                onClick={async () => {
                  const scope = confirmationScope.current;
                  if (!scope?.active) return;
                  setExportBusy(true);
                  setLocalError(null);
                  try {
                    const fresh = await fetchPlannerAnalysis(request);
                    if (!scope.active) return;
                    if (
                      fresh.accountId !== data.accountId ||
                      fresh.week.revision !== data.week.revision
                    )
                      throw new Error("Planul s-a schimbat. Reîncarcă săptămâna.");
                    if (!fresh.analysis.complete)
                      throw new Error("Planul conține date indisponibile; revizuiește mesele.");
                    if (
                      plannerShoppingFingerprint(fresh.analysis.shopping) !==
                      plannerShoppingFingerprint(preview.analysis.shopping)
                    ) {
                      setPreview({ signature, analysis: fresh.analysis });
                      setLocalError(
                        "Stocul sau necesarul s-a schimbat. Revizuiește și confirmă din nou.",
                      );
                      return;
                    }
                    if (
                      await exportWeek(
                        {
                          ...request,
                          fingerprint: plannerShoppingFingerprint(fresh.analysis.shopping),
                        },
                        fresh.analysis.shopping,
                        () => scope.active,
                      )
                    ) {
                      setPreview(null);
                      setMessage(
                        "Lista consolidată a fost generată. Inventarul și istoricul nu au fost modificate.",
                      );
                    }
                  } catch (e) {
                    setLocalError(e instanceof Error ? e.message : "Export indisponibil.");
                  } finally {
                    setExportBusy(false);
                  }
                }}
              >
                Confirmă generarea listei
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
