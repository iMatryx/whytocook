import type { Metadata } from "next";
import { Suspense } from "react";
import { RecipeSearchClient } from "@/components/recipes/recipe-search.client";
import { Skeleton } from "@/components/ui/skeleton";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.recipes.title };

export default function RecipesPage() {
  return (
    <Suspense
      fallback={<Skeleton className="h-96 rounded-2xl" aria-label="Se încarcă pagina de rețete" />}
    >
      <RecipeSearchClient />
    </Suspense>
  );
}
