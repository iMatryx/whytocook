import type { Metadata } from "next";
import { Suspense } from "react";
import { PlannerClient } from "@/components/planner/planner.client";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.planner.title };

export default function MealPlannerPage() {
  return (
    <Suspense fallback={<p role="status">Se încarcă plannerul…</p>}>
      <PlannerClient />
    </Suspense>
  );
}
