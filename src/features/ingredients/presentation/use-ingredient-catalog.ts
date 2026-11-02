"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ingredientSearchInputSchema, ingredientSearchResultSchema } from "../contracts";
import type { IngredientSearchResult } from "../contracts";

type Snapshot = {
  key: string;
  status: "ready" | "error";
  data: IngredientSearchResult | null;
  error: string | null;
  loadingMore: boolean;
};
export function useIngredientCatalog(
  query: string,
  locale: "ro-RO" | "ru-RU" | "en-GB",
  categoryId: string,
) {
  const [retryCount, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    key: "",
    status: "ready",
    data: null,
    error: null,
    loadingMore: false,
  });
  const sequence = useRef(0);
  const active = useRef<AbortController | null>(null);
  const input = useMemo(
    () =>
      ingredientSearchInputSchema.safeParse({
        query,
        locale,
        limit: 20,
        ...(categoryId ? { categoryId } : {}),
      }),
    [query, locale, categoryId],
  );
  const key = JSON.stringify([query, locale, categoryId, retryCount]);
  const load = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!input.success) return;
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      const request = ++sequence.current;
      if (append) setSnapshot((old) => ({ ...old, loadingMore: true, error: null }));
      try {
        const params = new URLSearchParams({
          query: input.data.query,
          locale: input.data.locale,
          limit: String(input.data.limit),
        });
        if (input.data.categoryId) params.set("categoryId", input.data.categoryId);
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/v1/ingredients?${params}`, {
          signal: controller.signal,
          credentials: "omit",
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error(
            response.status === 409
              ? "Catalogul s-a modificat. Reîncepe căutarea."
              : "Catalogul nu este disponibil momentan. Reîncearcă.",
          );
        const result = ingredientSearchResultSchema.parse(await response.json());
        if (controller.signal.aborted || request !== sequence.current) return;
        setSnapshot((old) => {
          if (append && old.data?.catalogVersion !== result.catalogVersion)
            return {
              ...old,
              status: "error",
              loadingMore: false,
              error: "Catalogul s-a modificat. Reîncepe căutarea.",
            };
          return {
            key,
            status: "ready",
            data: {
              ...result,
              items:
                append && old.key === key
                  ? [...(old.data?.items ?? []), ...result.items]
                  : result.items,
            },
            error: null,
            loadingMore: false,
          };
        });
      } catch (error) {
        if (controller.signal.aborted || request !== sequence.current) return;
        setSnapshot((old) => ({
          key,
          status: "error",
          data: append ? old.data : null,
          loadingMore: false,
          error:
            error instanceof Error && error.message.startsWith("Catalogul")
              ? error.message
              : "Catalogul nu este disponibil momentan. Reîncearcă.",
        }));
      }
    },
    [input, key],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      void load(null, false);
    }, 225);
    return () => {
      clearTimeout(timer);
      active.current?.abort();
    };
  }, [load]);
  const valid = input.success;
  const current = snapshot.key === key;
  return {
    items: valid && current ? (snapshot.data?.items ?? []) : [],
    nextCursor:
      valid && current && snapshot.status === "ready" ? (snapshot.data?.nextCursor ?? null) : null,
    loading: valid && !current,
    loadingMore: current && snapshot.loadingMore,
    error: !valid
      ? query.trim().length < 2
        ? null
        : "Folosește cel mult 80 de caractere și 8 cuvinte, în română, rusă sau engleză."
      : current
        ? snapshot.error
        : null,
    ready: valid && current && snapshot.status === "ready",
    retry: () => setRetry((value) => value + 1),
    loadMore: () => {
      if (current && snapshot.data?.nextCursor && !snapshot.loadingMore)
        void load(snapshot.data.nextCursor, true);
    },
  };
}
