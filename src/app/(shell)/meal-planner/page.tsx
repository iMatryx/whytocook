import { requirePageActor } from "@/server/auth/session.server";
import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder.server";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.planner.title };

export default async function MealPlannerPage() {
  await requirePageActor("/meal-planner");
  return <PagePlaceholder content={shellPages.planner} />;
}
