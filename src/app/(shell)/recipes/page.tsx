import type { Metadata } from "next";
import Link from "next/link";

import { PagePlaceholder } from "@/components/layout/page-placeholder.server";
import { Button } from "@/components/ui/button";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.recipes.title };

export default function RecipesPage() {
  return (
    <PagePlaceholder content={shellPages.recipes}>
      <Button asChild>
        <Link href="/my-fridge">Deschide frigiderul</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/recipes/demo">Vezi structura unei rețete</Link>
      </Button>
    </PagePlaceholder>
  );
}
