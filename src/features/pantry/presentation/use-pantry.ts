"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { pantryResponseSchema } from "../contracts";
import type { PantryCommand, PantryIngredient, PantryItem } from "../contracts";
import { readGuest, writeGuestCommand, guestStorageKey } from "./guest-storage";
type State = {
  status: "loading" | "ready" | "error";
  mode: "guest" | "account" | null;
  accountId: string | null;
  items: PantryItem[];
  error: string | null;
};
export function usePantry() {
  const [state, setState] = useState<State>({
    status: "loading",
    mode: null,
    accountId: null,
    items: [],
    error: null,
  });
  const [saving, setSaving] = useState(false);
  const localRaw = useRef<string | null>(null),
    pending = useRef<{ signature: string; id: string } | null>(null),
    busy = useRef(false),
    request = useRef(0);
  const reload = useCallback(async (signal?: AbortSignal) => {
    const generation = ++request.current;
    setState((old) => ({ ...old, status: "loading", error: null }));
    try {
      const response = await fetch("/api/v1/pantry", {
        credentials: "same-origin",
        cache: "no-store",
        ...(signal ? { signal } : {}),
      });
      if (response.status === 401) {
        const guest = readGuest(localStorage);
        if (generation !== request.current || signal?.aborted) return;
        localRaw.current = localStorage.getItem(guestStorageKey);
        setState({
          status: "ready",
          mode: "guest",
          accountId: null,
          items: guest.items,
          error: null,
        });
      } else {
        if (!response.ok)
          throw new Error("Inventarul contului nu este disponibil momentan. Reîncearcă.");
        const data = pantryResponseSchema.parse(await response.json());
        if (generation !== request.current || signal?.aborted) return;
        setState({
          status: "ready",
          mode: "account",
          accountId: data.accountId,
          items: data.items,
          error: null,
        });
      }
    } catch (error) {
      if (generation === request.current && !signal?.aborted)
        setState((old) => ({
          ...old,
          status: "error",
          error:
            error instanceof Error && !(error.name === "ZodError")
              ? error.message
              : "Inventarul nu poate fi încărcat.",
        }));
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void reload(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [reload]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const focus = () => {
      setState((old) => ({ ...old, status: "loading" }));
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 0);
    };
    const visibility = () => {
      if (document.visibilityState === "visible") focus();
      else {
        request.current++;
        setState((old) => ({ ...old, status: "loading" }));
      }
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [reload]);
  useEffect(() => {
    if (state.mode !== "guest") return;
    function changed(event: StorageEvent) {
      if (event.key !== guestStorageKey) return;
      try {
        const guest = readGuest(localStorage);
        localRaw.current = localStorage.getItem(guestStorageKey);
        setState((old) =>
          old.mode === "guest" && old.status === "ready"
            ? { status: "ready", mode: "guest", accountId: null, items: guest.items, error: null }
            : old,
        );
      } catch {
        setState((old) => ({
          ...old,
          status: "error",
          error:
            "Inventarul local s-a modificat și nu poate fi citit. Datele nu au fost înlocuite.",
        }));
      }
    }
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [state.mode]);
  async function save(
    command: PantryCommand,
    ingredient: PantryIngredient | null,
    expectedScope: string,
  ): Promise<string | null> {
    if (busy.current || state.status !== "ready")
      return "Așteaptă încărcarea sau salvarea inventarului.";
    if (expectedScope !== (state.accountId ?? "guest"))
      return "Contul s-a schimbat. Închide formularul și reîncarcă inventarul.";
    const generation = ++request.current;
    busy.current = true;
    setSaving(true);
    const signature = JSON.stringify([expectedScope, command]);
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: crypto.randomUUID() };
    const operationId = pending.current.id;
    try {
      if (state.mode === "guest") {
        const write = () => {
          if (generation !== request.current)
            throw new Error("Inventarul se reîncarcă. Verifică datele înainte de a salva.");
          return writeGuestCommand(
            localStorage,
            localRaw.current,
            operationId,
            command,
            ingredient,
          );
        };
        const next = navigator.locks
          ? await navigator.locks.request(guestStorageKey, write)
          : write();
        localRaw.current = localStorage.getItem(guestStorageKey);
        if (generation === request.current)
          setState({
            status: "ready",
            mode: "guest",
            accountId: null,
            items: next.items,
            error: null,
          });
      } else {
        const response = await fetch("/api/v1/pantry", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationId, expectedAccountId: expectedScope, command }),
        });
        if (!response.ok) {
          let message =
            response.status === 401
              ? "Sesiunea a expirat. Autentifică-te din nou; modificarea nu a fost salvată local."
              : "Salvarea nu a putut fi confirmată. Reîncearcă aceeași operație sau reîncarcă inventarul.";
          try {
            const body = (await response.json()) as { error?: { code?: string } };
            if (body.error?.code === "CONFLICT" || body.error?.code === "NOT_FOUND")
              message =
                "Inventarul s-a modificat. Închide formularul și reîncarcă înainte de a încerca din nou.";
            if (body.error?.code === "INSUFFICIENT_STOCK")
              message = "Cantitate insuficientă. Reîncarcă inventarul și verifică selecția.";
            if (body.error?.code === "SESSION_CHANGED")
              message = "Contul s-a schimbat. Închide formularul și reîncarcă inventarul.";
            if (body.error?.code === "INVALID_INPUT")
              message =
                "Verifică unitatea permisă, cantitatea și data. Ingredientul s-ar putea să se fi modificat.";
          } catch {}
          throw new Error(message);
        }
        const data = pantryResponseSchema.parse(await response.json());
        if (data.accountId !== expectedScope)
          throw new Error("Contul s-a schimbat. Reîncarcă inventarul.");
        if (generation === request.current)
          setState({
            status: "ready",
            mode: "account",
            accountId: data.accountId,
            items: data.items,
            error: null,
          });
      }
      pending.current = null;
      // A focus/session refresh may have raced a successful write. Read once
      // more after commit instead of publishing a response for an old scope.
      if (generation !== request.current) await reload();
      return null;
    } catch (error) {
      return error instanceof Error && error.name !== "ZodError"
        ? error.message
        : "Salvarea nu a putut fi confirmată. Reîncearcă aceeași operație.";
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return { ...state, saving, save, reload };
}
