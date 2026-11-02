"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  signInSchema,
  signUpSchema,
  emailSchema,
  newPasswordSchema,
  confirmEmailSchema,
  mfaCodeSchema,
  safeNext,
} from "../../features/auth/contracts/auth.schema";
import type { FormState } from "../../features/auth/contracts/auth.schema";
import { profileInputSchema } from "../../features/auth/contracts/profile.schema";
import { getSupabaseEnv } from "../../config/env/server";
import { AccessError } from "../http/access-error.server";
import { AuthFlowError } from "../auth/provider.server";
import { createVerifiedRequest } from "../auth/request-context.server";
import {
  assertActionOrigin,
  authProvider,
  clearSession,
  currentSession,
  currentRecoverySession,
  verifiedSession,
  writeSession,
} from "../auth/session.server";
import { saveMyProfile } from "../auth/profile.server";

function failure(error: unknown): FormState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: "Verifică datele introduse.",
      fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
    };
  }
  if (error instanceof AuthFlowError) return { status: "error", message: error.message };
  if (error instanceof AccessError && error.status === 401)
    return { status: "error", message: "Sesiunea a expirat. Autentifică-te din nou." };
  return { status: "error", message: "Operația nu a putut fi finalizată. Reîncearcă." };
}
function credentials(data: FormData) {
  return {
    email: data.get("email"),
    password: data.get("password"),
    confirmPassword: data.get("confirmPassword"),
  };
}
async function persistVerified(
  session: Awaited<ReturnType<ReturnType<typeof authProvider>["signIn"]>>,
) {
  const context = await createVerifiedRequest(`Bearer ${session.accessToken}`, getSupabaseEnv());
  if (context.actor.id !== session.userId) throw new AuthFlowError("AUTH_UNAVAILABLE");
  await writeSession(session);
  return context.actor;
}
export async function signInAction(_state: FormState, data: FormData): Promise<FormState> {
  try {
    await assertActionOrigin();
    const input = signInSchema.parse(credentials(data));
    await persistVerified(await authProvider().signIn(input.email, input.password));
  } catch (error) {
    return failure(error);
  }
  redirect(safeNext(data.get("next")));
}
export async function signUpAction(_state: FormState, data: FormData): Promise<FormState> {
  try {
    await assertActionOrigin();
    const input = signUpSchema.parse(credentials(data));
    await authProvider().signUp(input.email, input.password);
    return {
      status: "success",
      message:
        "Verifică e-mailul pentru confirmarea contului. Dacă ai deja un cont, folosește autentificarea sau recuperarea parolei.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function recoverAction(_state: FormState, data: FormData): Promise<FormState> {
  try {
    await assertActionOrigin();
    const input = emailSchema.parse({ email: data.get("email") });
    await authProvider().recover(input.email);
    return {
      status: "success",
      message:
        "Dacă există un cont pentru această adresă, vei primi un e-mail cu pașii de resetare.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function resendAction(_state: FormState, data: FormData): Promise<FormState> {
  try {
    await assertActionOrigin();
    const input = emailSchema.parse({ email: data.get("email") });
    await authProvider().resend(input.email);
    return {
      status: "success",
      message: "Verifică e-mailul. Dacă adresa necesită confirmare, vei primi un link nou.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function confirmAction(_state: FormState, data: FormData): Promise<FormState> {
  let type: "email" | "recovery";
  let needsMfa = false;
  try {
    await assertActionOrigin();
    const input = confirmEmailSchema.parse({
      tokenHash: data.get("tokenHash"),
      type: data.get("type"),
    });
    type = input.type;
    const session = await authProvider().verify(input.tokenHash, input.type);
    const actor = await persistVerified(session);
    needsMfa =
      type === "recovery" &&
      actor.aal !== "aal2" &&
      (await authProvider().factors(session.accessToken)).length > 0;
  } catch (error) {
    return failure(error);
  }
  if (needsMfa) redirect("/auth/mfa?next=%2Fauth%2Freset-password");
  redirect(type === "recovery" ? "/auth/reset-password" : "/profile?notice=email-confirmed");
}
export async function resetPasswordAction(_state: FormState, data: FormData): Promise<FormState> {
  let needsMfa = false;
  try {
    await assertActionOrigin();
    const input = newPasswordSchema.parse(credentials(data));
    const session = await currentRecoverySession();
    if (!session) throw new AuthFlowError("INVALID_LINK");
    // A valid recovery cookie is still checked against the current Auth identity.
    const context = await createVerifiedRequest(`Bearer ${session.accessToken}`, getSupabaseEnv());
    if (context.actor.id !== session.userId) throw new AuthFlowError("INVALID_LINK");
    needsMfa =
      context.actor.aal !== "aal2" &&
      (await authProvider().factors(session.accessToken)).length > 0;
    if (!needsMfa) {
      await authProvider().updatePassword(session.accessToken, input.password);
      try {
        await authProvider().logout(session.accessToken, "global");
      } catch {
        /* Local credentials are cleared even if revocation is unavailable. */
      }
      await clearSession();
    }
  } catch (error) {
    return failure(error);
  }
  if (needsMfa) redirect("/auth/mfa?next=%2Fauth%2Freset-password");
  redirect("/login?notice=password-reset");
}
export async function signOutAction(): Promise<void> {
  await assertActionOrigin();
  try {
    const session = await currentSession();
    if (session) await authProvider().signOut(session);
  } catch {
    /* Clear local credentials on provider failure. */
  }
  await clearSession();
  redirect("/login?notice=signed-out");
}
export async function saveProfileAction(_state: FormState, data: FormData): Promise<FormState> {
  try {
    await assertActionOrigin();
    const input = profileInputSchema.parse({
      displayName: data.get("displayName"),
      locale: data.get("locale"),
      timeZone: data.get("timeZone"),
      householdSize: data.get("householdSize"),
      mealBudget: data.get("mealBudget"),
      currency: data.get("currency"),
      dietIds: data.getAll("dietIds"),
      allergenIds: data.getAll("allergenIds"),
      equipmentIds: data.getAll("equipmentIds"),
    });
    await saveMyProfile(input);
    revalidatePath("/profile");
    return { status: "success", message: "Profilul a fost salvat." };
  } catch (error) {
    return failure(error);
  }
}
export async function enrollMfaAction(): Promise<FormState> {
  try {
    await assertActionOrigin();
    const { session } = await verifiedSession(true);
    const factor = await authProvider().enrollTotp(session.accessToken);
    return {
      status: "success",
      factorId: factor.id,
      totpSecret: factor.totp.secret,
      message: "Adaugă cheia în aplicația de autentificare, apoi introdu codul de șase cifre.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function verifyMfaAction(_state: FormState, data: FormData): Promise<FormState> {
  try {
    await assertActionOrigin();
    const input = mfaCodeSchema.parse({ factorId: data.get("factorId"), code: data.get("code") });
    const { session } = await verifiedSession(true);
    await persistVerified(await authProvider().verifyTotp(session, input.factorId, input.code));
  } catch (error) {
    return failure(error);
  }
  redirect(safeNext(data.get("next")));
}
