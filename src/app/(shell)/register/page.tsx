import { AuthForm } from "@/features/auth/presentation/auth-form";
import { AuthPanel } from "@/features/auth/presentation/auth-panel.server";
import { signUpAction } from "@/server/actions/auth-actions.server";
export const metadata = { title: "Creează cont" };
export default function RegisterPage() {
  return (
    <AuthPanel
      title="Gătește cu ce ai"
      description="Creează un cont pentru a păstra preferințele și ingredientele tale."
    >
      <AuthForm action={signUpAction} mode="register" />
    </AuthPanel>
  );
}
