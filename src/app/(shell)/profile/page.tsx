import type { Metadata } from "next";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/features/auth/presentation/profile-form";
import { saveProfileAction, signOutAction } from "@/server/actions/auth-actions.server";
import { requirePageActor } from "@/server/auth/session.server";
import { loadMyProfile } from "@/server/auth/profile.server";

export const metadata: Metadata = { title: "Profilul meu" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const context = await requirePageActor("/profile");
  const { profile, options } = await loadMyProfile(context);
  const notice = (await searchParams).notice;
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-4xl">Profilul meu</h1>
        <p className="mt-3 text-muted-foreground">
          Preferințele gospodăriei tale, într-un singur loc.
        </p>
      </div>
      {notice === "email-confirmed" && (
        <p role="status" className="rounded-md bg-accent p-3 text-sm">
          Adresa de e-mail a fost confirmată.
        </p>
      )}
      {notice === "access-denied" && (
        <p role="alert" className="rounded-md bg-danger p-3 text-sm text-danger-foreground">
          Contul tău nu are acces la acea secțiune.
        </p>
      )}
      <ProfileForm action={saveProfileAction} profile={profile} options={options} />
      <div className="flex flex-wrap items-center gap-5 border-t border-border pt-6">
        <Link href="/auth/mfa" className="text-sm underline underline-offset-4">
          Autentificare în doi pași
        </Link>
        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            Deconectează-te
          </Button>
        </form>
      </div>
    </div>
  );
}
