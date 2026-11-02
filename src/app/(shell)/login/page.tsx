import type { Metadata } from "next";

import Link from "next/link";
import { AuthForm } from "@/features/auth/presentation/auth-form";
import { AuthPanel } from "@/features/auth/presentation/auth-panel.server";
import { signInAction } from "@/server/actions/auth-actions.server";
import { safeNext } from "@/features/auth/contracts";

export const metadata: Metadata = { title: "Autentificare" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const notices: Record<string, string> = {
    "signed-out": "Te-ai deconectat.",
    "password-reset": "Parola a fost schimbată. Intră cu parola nouă.",
    "temporarily-unavailable": "Serviciul nu este disponibil momentan. Reîncearcă.",
  };
  return (
    <AuthPanel
      title="Bine ai revenit"
      description="Intră în cont pentru frigiderul, planurile și preferințele tale."
    >
      {params.notice && notices[params.notice] && (
        <p role="status" className="mb-5 rounded-md bg-accent p-3 text-sm">
          {notices[params.notice]}
        </p>
      )}
      <AuthForm action={signInAction} mode="login" next={safeNext(params.next)} />
      <p className="mt-5 text-sm">
        <Link className="underline underline-offset-4" href="/auth/resend">
          Nu ai primit confirmarea e-mailului?
        </Link>
      </p>
    </AuthPanel>
  );
}
