import { requirePageActor } from "@/server/auth/session.server";
import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder.server";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.shopping.title };

export default async function ShoppingListPage() {
  await requirePageActor("/shopping-list");
  return <PagePlaceholder content={shellPages.shopping} />;
}
