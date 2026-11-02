import { requirePageActor } from "@/server/auth/session.server";
import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder.server";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.favorites.title };

export default async function FavoritesPage() {
  await requirePageActor("/favorites");
  return <PagePlaceholder content={shellPages.favorites} />;
}
