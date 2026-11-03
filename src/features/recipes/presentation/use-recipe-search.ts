"use client";
import { useEffect, useState } from "react";
import { recipeSearchResponseSchema } from "../contracts/search.schema";
import type {
  RecipeFilters,
  RecipeSearchRequest,
  RecipeSearchResponse,
} from "../contracts/search.schema";
type State = {
  signature: string;
  status: "loading" | "ready" | "error";
  data: RecipeSearchResponse | null;
  error: string | null;
};
export function useRecipeSearch(
  filters: RecipeFilters | null,
  inventory: RecipeSearchRequest["inventory"],
  accountId: string | null,
  ready: boolean,
  today: string | null,
) {
  const signature = JSON.stringify([filters, inventory, accountId, today]);
  const [state, setState] = useState<State>({
    signature: "",
    status: "loading",
    data: null,
    error: null,
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!ready || !filters || !today) return;
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(() => {
      setState((old) => ({ ...old, signature, status: "loading", error: null }));
      void (async () => {
        try {
          const response = await fetch("/api/v1/recipes/search", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filters, inventory, today, expectedAccountId: accountId }),
          });
          if (!response.ok) {
            let message = "Rețetele nu pot fi încărcate momentan. Reîncearcă.";
            try {
              const body = (await response.json()) as { error?: { message?: string } };
              if (typeof body.error?.message === "string") message = body.error.message;
            } catch {}
            throw new Error(message);
          }
          const data = recipeSearchResponseSchema.parse(await response.json());
          if (data.accountId !== accountId)
            throw new Error("Contul s-a schimbat. Reîncarcă inventarul.");
          if (current) setState({ signature, status: "ready", data, error: null });
        } catch (error) {
          if (current && !controller.signal.aborted)
            setState({
              signature,
              status: "error",
              data: null,
              error:
                error instanceof Error && error.name !== "ZodError"
                  ? error.message
                  : "Datele rețetelor nu pot fi citite.",
            });
        }
      })();
    }, 0);
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer);
    };
    // signature contains the complete immutable request; avoids re-fetching on equivalent URL objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ready, retry]);
  return {
    status: !ready || state.signature !== signature ? ("loading" as const) : state.status,
    data: ready && state.signature === signature && state.status === "ready" ? state.data : null,
    error: state.signature === signature ? state.error : null,
    facets: state.data?.facets,
    reload: () => setRetry((v) => v + 1),
  };
}
