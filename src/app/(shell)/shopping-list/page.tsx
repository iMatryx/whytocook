import type { Metadata } from "next";
import { Suspense } from "react";
import { ShoppingClient } from "@/components/shopping/shopping.client";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.shopping.title };

export default function ShoppingListPage() {
  return (
    <Suspense fallback={<p role="status">Se încarcă lista…</p>}>
      <ShoppingClient />
    </Suspense>
  );
}
