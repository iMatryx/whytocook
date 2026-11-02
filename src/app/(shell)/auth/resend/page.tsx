import { AuthForm } from "@/features/auth/presentation/auth-form";
import { AuthPanel } from "@/features/auth/presentation/auth-panel.server";
import { resendAction } from "@/server/actions/auth-actions.server";
export const metadata = { title: "Confirmare e-mail" };
export default function ResendPage() {
  return (
    <AuthPanel
      title="Confirmă adresa de e-mail"
      description="Solicită un link nou dacă mesajul de confirmare nu a ajuns sau a expirat."
    >
      <AuthForm action={resendAction} mode="resend" />
    </AuthPanel>
  );
}
