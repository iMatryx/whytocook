"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  shoppingBootstrapSchema,
  shoppingSnapshotSchema,
  shoppingCommandSchema,
} from "../contracts";
import type { ShoppingBootstrap, ShoppingCommand, ShoppingItem } from "../contracts";
export type LocalShoppingPort = {
  load: (catalog: ShoppingBootstrap["catalog"], current: () => boolean) => Promise<ShoppingItem[]>;
  mutate: (
    catalog: ShoppingBootstrap["catalog"],
    command: ShoppingCommand,
    id: string,
    current: () => boolean,
  ) => Promise<ShoppingItem[]>;
};
async function body(response: Response) {
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = value as { error?: { message?: string } };
    throw new Error(
      error.error?.message ?? "Lista nu poate fi confirmată. Reîncarcă înainte de reîncercare.",
    );
  }
  return value;
}
export function useShopping(source: "demo" | "published", local: LocalShoppingPort) {
  const [data, setData] = useState<ShoppingBootstrap | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const version = useRef(0),
    alive = useRef(false),
    lock = useRef(false),
    refresh = useRef(false),
    pending = useRef<{ signature: string; id: string } | null>(null);
  const reload = useCallback(async () => {
    const v = ++version.current;
    setData(null);
    if (lock.current) {
      refresh.current = true;
      return;
    }
    setError(null);
    try {
      const result = shoppingBootstrapSchema.parse(
        await body(
          await fetch(`/api/v1/shopping?source=${source}`, {
            cache: "no-store",
            credentials: "same-origin",
          }),
        ),
      );
      const items =
        result.accountId === null
          ? await local.load(result.catalog, () => alive.current && v === version.current)
          : result.items;
      if (alive.current && v === version.current) setData({ ...result, items });
    } catch (e) {
      if (alive.current && v === version.current)
        setError(
          e instanceof Error && e.name !== "ZodError"
            ? e.message
            : "Datele listei sunt invalide sau stocarea este inaccesibilă. Nu au fost înlocuite.",
        );
    }
  }, [source, local]);
  useEffect(() => {
    alive.current = true;
    const timer = setTimeout(() => void reload(), 0),
      focus = () => void reload(),
      visibility = () => {
        if (document.visibilityState === "visible") focus();
        else {
          version.current++;
          setData(null);
        }
      },
      storage = (e: StorageEvent) => {
        if (
          !e.key ||
          ["cookly-shopping-v1", "cookly-pantry-v1", "cookly-recipe-actions-v1"].includes(e.key)
        )
          focus();
      };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("storage", storage);
    const invalidate = () => {
      version.current++;
    };
    return () => {
      alive.current = false;
      invalidate();
      clearTimeout(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("storage", storage);
    };
  }, [reload]);
  async function run(value: ShoppingCommand) {
    if (!data || lock.current) return false;
    const parsed = shoppingCommandSchema.safeParse(value);
    if (!parsed.success) {
      setError("Verifică datele. Un transfer poate conține 1–50 rânduri distincte.");
      return false;
    }
    const command = parsed.data,
      v = ++version.current;
    lock.current = true;
    setBusy(true);
    setError(null);
    const signature = JSON.stringify([data.accountId, command]);
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: crypto.randomUUID() };
    const id = pending.current.id;
    try {
      const context = shoppingBootstrapSchema.parse(
        await body(
          await fetch(`/api/v1/shopping?source=${source}`, {
            credentials: "same-origin",
            cache: "no-store",
          }),
        ),
      );
      if (context.accountId !== data.accountId)
        throw new Error("Contul s-a schimbat. Reîncarcă lista.");
      if (!alive.current || v !== version.current)
        throw new Error("Contextul s-a schimbat înainte de confirmare.");
      const next =
        data.accountId === null
          ? {
              accountId: null,
              items: await local.mutate(
                context.catalog,
                command,
                id,
                () => alive.current && v === version.current,
              ),
            }
          : shoppingSnapshotSchema.parse(
              await body(
                await fetch("/api/v1/shopping", {
                  method: "POST",
                  credentials: "same-origin",
                  cache: "no-store",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    expectedAccountId: data.accountId,
                    operationId: id,
                    command,
                  }),
                }),
              ),
            );
      if (next.accountId !== data.accountId) throw new Error("Contul s-a schimbat.");
      pending.current = null;
      if (alive.current && v === version.current) setData({ ...data, items: next.items });
      return true;
    } catch (e) {
      if (alive.current && v === version.current) {
        setData(null);
        setError(
          e instanceof Error && e.name !== "ZodError"
            ? e.message
            : "Verifică datele și spațiul disponibil. Transferul local poate necesita recuperare la reîncărcare.",
        );
      }
      return false;
    } finally {
      lock.current = false;
      if (alive.current) {
        setBusy(false);
        if (refresh.current) {
          refresh.current = false;
          void reload();
        }
      }
    }
  }
  return { data, error, busy, reload, run };
}
