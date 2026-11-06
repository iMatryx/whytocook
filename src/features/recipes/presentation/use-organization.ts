"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { organizationSnapshotSchema } from "../contracts/organization.schema";
import type { OrganizationCommand, OrganizationSnapshot } from "../contracts/organization.schema";
import { readLocalActions, localRecipeActionsKey } from "./recipe-actions-storage";
import { writeLocalOrganization } from "./organization-storage";
const endpoint = "/api/v1/recipes/organization";
async function responseData(response: Response) {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error !== null &&
      "message" in body.error &&
      typeof body.error.message === "string"
        ? body.error.message
        : "Organizarea rețetelor nu poate fi încărcată. Reîncearcă.";
    throw new Error(message);
  }
  return organizationSnapshotSchema.parse(body);
}
function localSnapshot(): OrganizationSnapshot {
  const state = readLocalActions(localStorage);
  return organizationSnapshotSchema.parse({
    accountId: null,
    favorites: state.favorites,
    collections: state.collections,
    cooked: [...state.cooked].reverse(),
    titles: {},
  });
}
export function useOrganization() {
  const [data, setData] = useState<OrganizationSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const generation = useRef(0),
    lock = useRef(false),
    mounted = useRef(false),
    refreshPending = useRef(false);
  const reload = useCallback(async () => {
    if (lock.current) {
      generation.current++;
      refreshPending.current = true;
      setData(null);
      return;
    }
    const version = ++generation.current;
    setData(null);
    setError(null);
    try {
      const remote = await responseData(
        await fetch(endpoint, { cache: "no-store", credentials: "same-origin" }),
      );
      const next = remote.accountId === null ? localSnapshot() : remote;
      if (mounted.current && generation.current === version) setData(next);
    } catch (e) {
      if (mounted.current && generation.current === version)
        setError(
          e instanceof Error && e.name !== "ZodError"
            ? e.message
            : "Datele locale sunt invalide sau inaccesibile. Nu au fost înlocuite.",
        );
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const invalidate = () => {
      generation.current++;
    };
    const timer = setTimeout(() => void reload(), 0);
    const refresh = () => {
      void reload();
    };
    const storage = (e: StorageEvent) => {
      if (e.key === localRecipeActionsKey || e.key === null) refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false;
      invalidate();
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [reload]);
  async function run(command: OrganizationCommand): Promise<boolean> {
    if (!data || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    const version = ++generation.current;
    try {
      // Recheck the session before touching guest storage; never fall back on auth errors.
      const current = await responseData(
        await fetch(endpoint, { cache: "no-store", credentials: "same-origin" }),
      );
      if (current.accountId !== data.accountId)
        throw new Error("Contul s-a schimbat. Reîncarcă lista.");
      let next: OrganizationSnapshot;
      if (data.accountId !== null) {
        next = await responseData(
          await fetch(endpoint, {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedAccountId: data.accountId, command }),
          }),
        );
        if (next.accountId !== data.accountId)
          throw new Error("Contul s-a schimbat. Reîncarcă lista.");
      } else {
        const write = () => {
          if (!mounted.current || generation.current !== version)
            throw new Error("Contextul s-a schimbat.");
          writeLocalOrganization(
            localStorage,
            localStorage.getItem(localRecipeActionsKey),
            command,
          );
        };
        if (navigator.locks) await navigator.locks.request(localRecipeActionsKey, write);
        else write();
        next = localSnapshot();
      }
      if (mounted.current && generation.current === version) setData(next);
      return true;
    } catch (e) {
      if (mounted.current && generation.current === version) {
        setData(null);
        setError(
          e instanceof Error && e.name !== "ZodError"
            ? e.message
            : "Verifică datele și spațiul disponibil în browser. Datele nu au fost înlocuite.",
        );
      }
      return false;
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        if (refreshPending.current) {
          refreshPending.current = false;
          void reload();
        }
      }
    }
  }
  return { data, busy, error, reload, run };
}
