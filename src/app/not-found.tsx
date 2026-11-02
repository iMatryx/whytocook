import { AppShell } from "@/components/layout/app-shell.server";
import { NotFoundContent } from "@/components/layout/not-found-content.server";

export default function NotFound() {
  return (
    <AppShell>
      <NotFoundContent />
    </AppShell>
  );
}
