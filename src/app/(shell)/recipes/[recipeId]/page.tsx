import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { RecipeDetailClient } from "@/components/recipes/recipe-detail.client";
import { Skeleton } from "@/components/ui/skeleton";
import { shellPages } from "@/config/shell-pages";
import { RecipeRouteIdSchema } from "@/shared/contracts/recipe-route.schema";

export const metadata: Metadata = { title: shellPages.recipeDetails.title };

export default async function RecipeDetailsPage({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const { recipeId } = await params;
  if (
    !RecipeRouteIdSchema.safeParse(recipeId).success ||
    recipeId.length > 100 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipeId)
  )
    notFound();
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" aria-label="Se încarcă rețeta" />}>
      <RecipeDetailClient slug={recipeId} />
    </Suspense>
  );
}
