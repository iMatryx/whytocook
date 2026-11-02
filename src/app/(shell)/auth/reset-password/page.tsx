import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/presentation/auth-form";
import { AuthPanel } from "@/features/auth/presentation/auth-panel.server";
import { resetPasswordAction } from "@/server/actions/auth-actions.server";
import {
  currentRecoverySession,
  requirePageActor,
  authProvider,
} from "@/server/auth/session.server";
export const metadata = { title: "Parolă nouă" };
export default async function ResetPasswordPage() {
  const session = await currentRecoverySession();
  if (!session) redirect("/forgot-password?notice=expired-link");
  const { actor } = await requirePageActor("/auth/reset-password");
  if (actor.aal !== "aal2" && (await authProvider().factors(session.accessToken)).length > 0)
    redirect("/auth/mfa?next=%2Fauth%2Freset-password");
  return (
    <AuthPanel
      title="Alege o parolă nouă"
      description="După salvare, te vei autentifica folosind parola nouă."
    >
      <AuthForm action={resetPasswordAction} mode="reset" />
    </AuthPanel>
  );
}
