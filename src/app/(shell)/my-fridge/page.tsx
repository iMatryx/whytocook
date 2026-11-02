import { requirePageActor } from "@/server/auth/session.server";
import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder.server";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.fridge.title };

export default async function FridgePage() {
  await requirePageActor("/my-fridge");
  return <PagePlaceholder content={shellPages.fridge} />;
}
