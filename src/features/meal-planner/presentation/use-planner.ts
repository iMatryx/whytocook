"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  plannerBootstrapSchema,
  plannerSnapshotSchema,
  plannerCommandSchema,
  plannerAnalysisEnvelopeSchema,
  plannerExportResultSchema,
  plannerAnalyzeRequestSchema,
} from "../contracts";
import type { PlannerWeek, PlannerBootstrap, PlannerCommand } from "../contracts";
import type { ListItem } from "@/shared/domain/shopping";
export type LocalPlannerPort = {
  load: (day: string, source: "demo" | "published", current: () => boolean) => Promise<PlannerWeek>;
  mutate: (
    day: string,
    source: "demo" | "published",
    command: PlannerCommand,
    revision: string,
    id: string,
    recipes: PlannerBootstrap["recipes"],
    current: () => boolean,
  ) => Promise<PlannerWeek>;
  exportWeek: (
    day: string,
    source: "demo" | "published",
    revision: string,
    id: string,
    items: ListItem[],
    inventory: PlannerBootstrap["inventory"],
    current: () => boolean,
  ) => Promise<PlannerWeek>;
};
export async function plannerBody(response: Response) {
  const value: unknown = await response.json();
  if (!response.ok) {
    const b = value as { error?: { message?: string } };
    throw new Error(b.error?.message ?? "Planul nu poate fi confirmat. Reîncarcă săptămâna.");
  }
  return value;
}
export function usePlanner(
  startsOn: string,
  source: "demo" | "published",
  local: LocalPlannerPort,
) {
  const [data, setData] = useState<PlannerBootstrap | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const generation = useRef(0),
    alive = useRef(false),
    lock = useRef(false),
    refresh = useRef(false),
    live = useRef<{ data: PlannerBootstrap; url: string } | null>(null),
    latestReload = useRef<(() => Promise<void>) | null>(null),
    pending = useRef<{ signature: string; id: string } | null>(null);
  const url = `/api/v1/planner?startsOn=${startsOn}&source=${source}`;
  const reload = useCallback(async () => {
    const v = ++generation.current;
    live.current = null;
    setData(null);
    if (lock.current) {
      refresh.current = true;
      return;
    }
    setError(null);
    try {
      const result = plannerBootstrapSchema.parse(
        await plannerBody(await fetch(url, { cache: "no-store", credentials: "same-origin" })),
      );
      const week =
        result.accountId === null
          ? await local.load(startsOn, source, () => alive.current && v === generation.current)
          : result.week;
      if (alive.current && v === generation.current) {
        const next = { ...result, week };
        live.current = { data: next, url };
        setData(next);
      }
    } catch (e) {
      if (alive.current && v === generation.current)
        setError(
          e instanceof Error && e.name !== "ZodError"
            ? e.message
            : "Planul local este invalid sau inaccesibil. Datele nu au fost înlocuite.",
        );
    }
  }, [url, startsOn, source, local]);
  useEffect(() => {
    alive.current = true;
    latestReload.current = reload;
    const timer = setTimeout(() => void reload(), 0),
      focus = () => void reload(),
      visible = () => {
        if (document.visibilityState === "visible") focus();
        else {
          generation.current++;
          live.current = null;
          setData(null);
        }
      },
      storage = (e: StorageEvent) => {
        if (
          !e.key ||
          e.key.startsWith("cookly-meal-plan-v1:") ||
          e.key === "cookly-shopping-v1" ||
          e.key === "cookly-pantry-v1"
        )
          focus();
      };
    const invalidate = () => {
      generation.current++;
    };
    window.addEventListener("focus", focus);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive.current = false;
      live.current = null;
      invalidate();
      clearTimeout(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [reload]);
  async function save(command: PlannerCommand) {
    return perform({ command });
  }
  async function exportWeek(
    body: Record<string, unknown>,
    items: ListItem[],
    current: () => boolean,
  ) {
    return perform({ exportBody: body, items, current });
  }
  async function perform(
    action:
      | { command: PlannerCommand }
      | { exportBody: Record<string, unknown>; items: ListItem[]; current: () => boolean },
  ) {
    // A callback can resume after its view has navigated or revalidated.
    if (!data || lock.current || live.current?.data !== data || live.current.url !== url)
      return false;
    if ("current" in action && !action.current()) return false;
    const v = ++generation.current;
    lock.current = true;
    setBusy(true);
    setError(null);
    const signature = JSON.stringify([
      startsOn,
      source,
      data.accountId,
      data.week.revision,
      action,
    ]);
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: crypto.randomUUID() };
    const operationId = pending.current.id;
    try {
      const context = plannerBootstrapSchema.parse(
        await plannerBody(await fetch(url, { credentials: "same-origin", cache: "no-store" })),
      );
      if (context.accountId !== data.accountId)
        throw new Error("Contul s-a schimbat. Reîncarcă plannerul.");
      if (!alive.current || v !== generation.current) throw new Error("Contextul s-a schimbat.");
      if ("current" in action && !action.current())
        throw new Error("Inventarul sau contextul s-a schimbat.");
      let week: PlannerWeek;
      if ("command" in action) {
        const command = plannerCommandSchema.parse(action.command);
        if (data.accountId === null)
          week = await local.mutate(
            startsOn,
            source,
            command,
            data.week.revision,
            operationId,
            context.recipes,
            () => alive.current && v === generation.current,
          );
        else {
          const result = plannerSnapshotSchema.parse(
            await plannerBody(
              await fetch("/api/v1/planner", {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  startsOn,
                  expectedAccountId: data.accountId,
                  expectedRevision: data.week.revision,
                  operationId,
                  command,
                }),
              }),
            ),
          );
          if (result.accountId !== data.accountId) throw new Error("Contul s-a schimbat.");
          week = result.week;
        }
      } else if (data.accountId === null)
        week = await local.exportWeek(
          startsOn,
          source,
          data.week.revision,
          operationId,
          action.items,
          plannerAnalyzeRequestSchema.shape.inventory.parse(action.exportBody.inventory),
          () => alive.current && v === generation.current && action.current(),
        );
      else {
        const result = plannerExportResultSchema.parse(
          await plannerBody(
            await fetch("/api/v1/planner/export", {
              method: "POST",
              credentials: "same-origin",
              cache: "no-store",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...action.exportBody,
                expectedRevision: data.week.revision,
                operationId,
              }),
            }),
          ),
        );
        if (result.accountId !== data.accountId) throw new Error("Contul s-a schimbat.");
        week = result.week;
      }
      if (!alive.current || v !== generation.current) return false;
      pending.current = null;
      if (!("command" in action && action.command.kind === "copyWeek")) {
        const next = { ...data, week };
        live.current = { data: next, url };
        setData(next);
      }
      return true;
    } catch (e) {
      if (alive.current && v === generation.current) {
        live.current = null;
        setData(null);
        setError(
          e instanceof Error && e.name !== "ZodError"
            ? e.message
            : "Verifică planul, datele și spațiul local disponibil.",
        );
      }
      return false;
    } finally {
      lock.current = false;
      if (alive.current) {
        setBusy(false);
        if (refresh.current) {
          refresh.current = false;
          void latestReload.current?.();
        }
      }
    }
  }
  return { data, busy, error, reload, save, exportWeek };
}
export async function fetchPlannerAnalysis(body: Record<string, unknown>) {
  return plannerAnalysisEnvelopeSchema.parse(
    await plannerBody(
      await fetch("/api/v1/planner/analyze", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    ),
  );
}
