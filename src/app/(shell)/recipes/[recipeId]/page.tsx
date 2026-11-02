import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PagePlaceholder } from "@/components/layout/page-placeholder.server";
import { Button } from "@/components/ui/button";
import { shellPages } from "@/config/shell-pages";
import { RecipeRouteIdSchema } from "@/shared/contracts/recipe-route.schema";

export const metadata: Metadata = { title: shellPages.recipeDetails.title };

export default async function RecipeDetailsPage({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const { recipeId } = await params;
  if (!RecipeRouteIdSchema.safeParse(recipeId).success) notFound();
  return (
    <PagePlaceholder content={shellPages.recipeDetails}>
      <Button asChild variant="outline">
        <Link href="/recipes">Înapoi la rețete</Link>
      </Button>
    </PagePlaceholder>
  );
}
