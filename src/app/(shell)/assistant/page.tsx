import { requirePageActor } from "@/server/auth/session.server";
import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder.server";
import { shellPages } from "@/config/shell-pages";

export const metadata: Metadata = { title: shellPages.assistant.title };

export default async function AssistantPage() {
  await requirePageActor("/assistant");
  return <PagePlaceholder content={shellPages.assistant} />;
}
