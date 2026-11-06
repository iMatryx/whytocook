import { z } from "zod";
import { plannerWeekSchema, plannerCommandSchema, plannerDay } from "../contracts/index.ts";
import type { PlannerWeek, PlannerCommand, PlannerRecipe } from "../contracts/index.ts";
import { addPlannerDays } from "../../../shared/domain/meal-planner.ts";
export const plannerStateSchema = z
  .object({
    version: z.literal(1),
    week: plannerWeekSchema,
    operations: z
      .array(z.object({ id: z.uuid(), signature: z.string().max(100000) }).strict())
      .max(100),
    exportLinks: z
      .array(z.object({ id: z.uuid(), revision: z.string().regex(/^[1-9]\d*$/) }).strict())
      .max(100),
  })
  .strict();
export type PlannerState = z.infer<typeof plannerStateSchema>;
export const plannerKey = (day: string, source: "demo" | "published") =>
  `cookly-meal-plan-v1:${source}:${plannerDay.parse(day)}`;
export function emptyPlanner(startsOn: string): PlannerState {
  return {
    version: 1,
    week: plannerWeekSchema.parse({
      startsOn,
      revision: "0",
      budget: null,
      entries: [],
      exportedRevision: null,
    }),
    operations: [],
    exportLinks: [],
  };
}
export function readPlanner(raw: string | null, startsOn: string) {
  if (raw === null) return emptyPlanner(startsOn);
  if (raw.length > 500000) throw new Error("Planul local este prea mare.");
  const state = plannerStateSchema.parse(JSON.parse(raw));
  if (state.week.startsOn !== startsOn) throw new Error("Săptămână locală nepotrivită.");
  return state;
}
export const plannerSignature = (startsOn: string, revision: string, command: unknown) =>
  JSON.stringify([startsOn, revision, command]);
export function recordPlanner(state: PlannerState, id: string, signature: string) {
  const next = plannerStateSchema.parse({
    ...state,
    operations: [...state.operations, { id, signature }].slice(-100),
  });
  while (next.operations.length > 1 && JSON.stringify(next).length > 450000)
    next.operations.shift();
  if (JSON.stringify(next).length > 500000)
    throw new Error("Planul depășește spațiul local disponibil.");
  return next;
}
export function plannerReplay(state: PlannerState, id: string, signature: string) {
  const old = state.operations.find((o) => o.id === id);
  if (old && old.signature !== signature) throw new Error("Operație reutilizată cu alt plan.");
  return !!old;
}
export function availablePlannerEntry(
  entry: PlannerWeek["entries"][number],
  recipes: readonly PlannerRecipe[],
) {
  return recipes.some(
    (r) =>
      r.key === entry.recipeKey &&
      r.versionId === entry.versionId &&
      r.revision === entry.recipeRevision,
  );
}
export function applyPlanner(
  state: PlannerState,
  value: PlannerCommand,
  expectedRevision: string,
  operationId: string,
  recipes: readonly PlannerRecipe[],
) {
  const command = plannerCommandSchema.parse(value),
    signature = plannerSignature(state.week.startsOn, expectedRevision, command);
  if (plannerReplay(state, operationId, signature)) return state;
  if (state.week.revision !== expectedRevision)
    throw new Error("Planul s-a modificat. Reîncarcă săptămâna.");
  let week = { ...state.week, entries: [...state.week.entries] };
  if (command.kind === "saveEntry") {
    const exists = week.entries.some((e) => e.id === command.entry.id);
    if (command.create ? exists : !exists)
      throw new Error("Masa nu mai este disponibilă pentru această operație.");
    if (!availablePlannerEntry(command.entry, recipes))
      throw new Error("Rețeta sau versiunea nu mai este disponibilă.");
    week.entries = command.create
      ? [...week.entries, command.entry]
      : week.entries.map((e) => (e.id === command.entry.id ? command.entry : e));
  } else if (command.kind === "removeEntry") {
    if (!week.entries.some((e) => e.id === command.id)) throw new Error("Masa nu mai există.");
    week.entries = week.entries.filter((e) => e.id !== command.id);
  } else if (command.kind === "configure") week.budget = command.budget;
  else throw new Error("Copierea cere verificarea săptămânii țintă.");
  week = plannerWeekSchema.parse({ ...week, revision: String(BigInt(week.revision) + 1n) });
  return recordPlanner({ ...state, week }, operationId, signature);
}
export function copyPlanner(
  state: PlannerState,
  target: string,
  expected: string,
  id: string,
  recipes: readonly PlannerRecipe[],
) {
  if (state.week.revision !== expected) throw new Error("Planul sursă s-a modificat.");
  if (state.week.entries.some((e) => !availablePlannerEntry(e, recipes)))
    throw new Error("Actualizează rețetele indisponibile înainte de copiere.");
  const shift =
    (Date.parse(target + "T00:00:00Z") - Date.parse(state.week.startsOn + "T00:00:00Z")) / 86400000;
  const week = plannerWeekSchema.parse({
    ...state.week,
    startsOn: target,
    revision: "1",
    exportedRevision: null,
    entries: state.week.entries.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      plannedOn: addPlannerDays(e.plannedOn, shift),
      prepOn: e.prepOn ? addPlannerDays(e.prepOn, shift) : null,
    })),
  });
  return recordPlanner(
    { ...emptyPlanner(target), week },
    id,
    plannerSignature(state.week.startsOn, expected, { kind: "copyWeek", targetStartsOn: target }),
  );
}
