import Link from "next/link";
import { ErrorState } from "@/components/feedback/error-state";
import { confirmEmailSchema } from "@/features/auth/contracts";
import { AuthForm } from "@/features/auth/presentation/auth-form";
import { AuthPanel } from "@/features/auth/presentation/auth-panel.server";
import { confirmAction } from "@/server/actions/auth-actions.server";
export const metadata = { title: "Confirmă linkul" };
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;
  const input = confirmEmailSchema.safeParse({ tokenHash: params.token_hash, type: params.type });
  return (
    <AuthPanel
      title="Continuă în Cookly"
      description="Confirmă folosirea linkului primit prin e-mail."
    >
      {input.success ? (
        <AuthForm
          action={confirmAction}
          mode="confirm"
          tokenHash={input.data.tokenHash}
          type={input.data.type}
        />
      ) : (
        <div className="space-y-5">
          <ErrorState
            title="Link indisponibil"
            description="Linkul nu este valid. Solicită un mesaj nou pentru a continua."
          />
          <Link className="underline underline-offset-4" href="/auth/resend">
            Solicită o confirmare nouă
          </Link>
        </div>
      )}
    </AuthPanel>
  );
}
