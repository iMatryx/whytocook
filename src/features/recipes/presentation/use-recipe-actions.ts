"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { recipeActionStateSchema } from "../contracts/detail.schema";
import type {
  RecipeActionCommand,
  RecipeActionState,
  RecipeDetailResponse,
} from "../contracts/detail.schema";
import {
  readLocalActions,
  writeLocalAction,
  localRecipeActionsKey,
} from "./recipe-actions-storage";
export function useRecipeActions(data: RecipeDetailResponse, active = true) {
  const remote = data.accountId !== null && data.source === "published",
    key = `${data.source}:${data.recipe.key}`;
  const [state, setState] = useState<RecipeActionState>(
    data.actions ?? { favorite: false, lastCookedAt: null, addedCount: 0 },
  );
  const [ready, setReady] = useState(remote),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const alive = useRef(true),
    lock = useRef(false),
    raw = useRef<string | null>(null),
    memory = useRef<string | null>(null),
    pending = useRef<{ signature: string; id: string } | null>(null);
  const activeContext = useRef(active);
  useEffect(() => {
    activeContext.current = active;
  }, [active]);
  const ephemeral = data.accountId !== null && data.source === "demo";
  useEffect(() => {
    alive.current = true;
    if (remote)
      return () => {
        alive.current = false;
      };
    const timer = setTimeout(() => {
      try {
        const storage = ephemeral ? { getItem: () => memory.current } : localStorage,
          stored = readLocalActions(storage);
        raw.current = storage.getItem(localRecipeActionsKey);
        setState({
          favorite: stored.favorites.includes(key),
          lastCookedAt: [...stored.cooked].reverse().find((c) => c.recipeKey === key)?.at ?? null,
          addedCount: 0,
        });
        setReady(true);
      } catch {
        setError("Acțiunile locale nu pot fi citite. Datele nu au fost înlocuite.");
      }
    }, 0);
    return () => {
      alive.current = false;
      clearTimeout(timer);
    };
  }, [key, remote, ephemeral]);
  async function run(command: RecipeActionCommand): Promise<string | null> {
    if (!active || !ready || lock.current) return "Așteaptă încărcarea sau salvarea acțiunilor.";
    lock.current = true;
    setBusy(true);
    setError(null);
    const signature = JSON.stringify([key, data.recipe.revision, command]);
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: crypto.randomUUID() };
    const operationId = pending.current.id;
    try {
      let next: RecipeActionState;
      if (remote) {
        const response = await fetch("/api/v1/recipes/actions", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: data.recipe.key,
            revision: data.recipe.revision,
            operationId,
            expectedAccountId: data.accountId,
            command,
          }),
        });
        if (!response.ok) {
          let message = "Acțiunea nu a putut fi confirmată. Poți reîncerca aceeași operație.";
          try {
            const body = (await response.json()) as { error?: { message?: string } };
            if (body.error?.message) message = body.error.message;
          } catch {}
          throw new Error(message);
        }
        const result = recipeActionStateSchema
          .extend({ accountId: z.uuid() })
          .strict()
          .parse(await response.json());
        if (result.accountId !== data.accountId)
          throw new Error("Contul s-a schimbat. Reîncarcă pagina.");
        next = result;
      } else {
        const storage = ephemeral
          ? {
              getItem: () => memory.current,
              setItem: (_key: string, value: string) => {
                memory.current = value;
              },
            }
          : localStorage;
        const write = () => {
          if (!alive.current || !activeContext.current)
            throw new Error("Contextul rețetei s-a schimbat.");
          return writeLocalAction(
            storage,
            raw.current,
            key,
            operationId,
            command,
            new Date().toISOString(),
          );
        };
        const stored =
          !ephemeral && navigator.locks
            ? await navigator.locks.request(localRecipeActionsKey, write)
            : write();
        raw.current = storage.getItem(localRecipeActionsKey);
        next = {
          favorite: stored.favorites.includes(key),
          lastCookedAt: [...stored.cooked].reverse().find((c) => c.recipeKey === key)?.at ?? null,
          addedCount: command.kind === "shopping" ? command.items.length : 0,
        };
      }
      pending.current = null;
      if (alive.current) setState(next);
      return null;
    } catch (error) {
      const message =
        error instanceof Error && error.name !== "ZodError"
          ? error.message
          : "Verifică acțiunea, cantitățile și capacitatea stocării locale.";
      if (alive.current) setError(message);
      return message;
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return {
    ...state,
    ready,
    busy,
    error,
    run,
    label: remote
      ? "Acțiuni sincronizate cu contul"
      : ephemeral
        ? "Acțiuni demo în memoria paginii"
        : "Acțiuni salvate în acest browser",
  };
}
