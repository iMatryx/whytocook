"use client";
import { useEffect, useState } from "react";
import { recipeDetailResponseSchema } from "../contracts/detail.schema";
import type { RecipeDetailRequest, RecipeDetailResponse } from "../contracts/detail.schema";
export function useRecipeDetail(request: RecipeDetailRequest | null, ready: boolean) {
  const signature = JSON.stringify(request),
    context = JSON.stringify(
      request && [
        request.source,
        request.slug,
        request.servings,
        request.allergy,
        request.exclude,
        request.expectedAccountId,
      ],
    ),
    [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    signature: string;
    context: string;
    data: RecipeDetailResponse | null;
    status: "loading" | "ready" | "error";
    error: string | null;
    notFound: boolean;
  }>({ signature: "", context: "", data: null, status: "loading", error: null, notFound: false });
  useEffect(() => {
    if (!request || !ready) return;
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(() => {
      setState((previous) => ({
        signature,
        context,
        data: previous.context === context ? previous.data : null,
        status: "loading",
        error: null,
        notFound: false,
      }));
      void (async () => {
        try {
          const response = await fetch("/api/v1/recipes/detail", {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: signature,
          });
          if (!response.ok) {
            let message = "Rețeta nu poate fi încărcată.";
            try {
              const error = (await response.json()) as { error?: { message?: string } };
              if (typeof error.error?.message === "string") message = error.error.message;
            } catch {}
            if (current)
              setState({
                signature,
                context,
                data: null,
                status: "error",
                error: message,
                notFound: response.status === 404,
              });
            return;
          }
          const data = recipeDetailResponseSchema.parse(await response.json());
          if (data.accountId !== request.expectedAccountId)
            throw new Error("Contul s-a schimbat. Reîncarcă inventarul.");
          if (current)
            setState({ signature, context, data, status: "ready", error: null, notFound: false });
        } catch (error) {
          if (current && !controller.signal.aborted)
            setState({
              signature,
              context,
              data: null,
              status: "error",
              error:
                error instanceof Error && error.name !== "ZodError"
                  ? error.message
                  : "Datele rețetei nu pot fi citite.",
              notFound: false,
            });
        }
      })();
    }, 0);
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer);
    };
    // The full validated request is represented by signature, including account and inventory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ready, retry]);
  const fresh = ready && state.signature === signature;
  return {
    data: fresh && state.status === "ready" ? state.data : null,
    retainedData: state.context === context ? state.data : null,
    status: fresh ? state.status : ("loading" as const),
    error: fresh ? state.error : null,
    notFound: fresh && state.notFound,
    reload: () => setRetry((n) => n + 1),
  };
}
