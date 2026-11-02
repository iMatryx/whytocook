import { AuthForm } from "@/features/auth/presentation/auth-form";
import { AuthPanel } from "@/features/auth/presentation/auth-panel.server";
import { recoverAction } from "@/server/actions/auth-actions.server";
export const metadata = { title: "Recuperează parola" };
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const expired = (await searchParams).notice === "expired-link";
  return (
    <AuthPanel
      title="Ai uitat parola?"
      description="Introdu adresa de e-mail și îți trimitem pașii de resetare."
    >
      {expired && (
        <p role="alert" className="mb-5 rounded-md bg-danger p-3 text-sm text-danger-foreground">
          Linkul de recuperare a expirat. Solicită unul nou.
        </p>
      )}
      <AuthForm action={recoverAction} mode="recover" />
    </AuthPanel>
  );
}
