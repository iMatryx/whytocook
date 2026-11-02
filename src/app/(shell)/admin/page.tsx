import { requirePageActor } from "@/server/auth/session.server";
import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder.server";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.admin.title };

export default async function AdminPage() {
  await requirePageActor("/admin", ["editor", "admin"]);
  return <PagePlaceholder content={shellPages.admin} />;
}
