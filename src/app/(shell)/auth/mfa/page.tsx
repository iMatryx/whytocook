import { redirect } from "next/navigation";
import { safeNext } from "@/features/auth/contracts";
import { AuthPanel } from "@/features/auth/presentation/auth-panel.server";
import { MfaForm } from "@/features/auth/presentation/mfa-form";
import { enrollMfaAction, verifyMfaAction } from "@/server/actions/auth-actions.server";
import { authProvider, requirePageActor } from "@/server/auth/session.server";
export const metadata = { title: "Autentificare în doi pași" };
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { session, actor } = await requirePageActor("/profile");
  const next = safeNext((await searchParams).next);
  if (actor.aal === "aal2") redirect(next);
  const factors = await authProvider().factors(session.accessToken);
  return (
    <AuthPanel
      title="Autentificare în doi pași"
      description="Verifică un cod TOTP pentru a continua cu accesul protejat."
    >
      <MfaForm
        enrollAction={enrollMfaAction}
        verifyAction={verifyMfaAction}
        {...(factors[0] ? { factorId: factors[0].id } : {})}
        next={next}
      />
    </AuthPanel>
  );
}
