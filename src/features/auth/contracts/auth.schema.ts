import { z } from "zod";

const email = z.email().trim().toLowerCase().max(254);
export const passwordSchema = z.string().min(12, "Folosește minimum 12 caractere.").max(128);
export const signInSchema = z.object({ email, password: z.string().min(1).max(128) });
export const signUpSchema = signInSchema
  .extend({ password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Parolele trebuie să coincidă.",
  });
export const emailSchema = z.object({ email });
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Parolele trebuie să coincidă.",
  });
export const confirmEmailSchema = z.object({
  tokenHash: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/),
  type: z.enum(["email", "recovery"]),
});
export const mfaCodeSchema = z.object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) });
export const authSessionSchema = z
  .object({
    accessToken: z.string().min(20).max(3500),
    refreshToken: z.string().min(10).max(256),
    userId: z.uuid(),
    expiresAt: z.number().int().positive(),
    validUntil: z.number().int().positive(),
    recoveryUntil: z.number().int().positive().optional(),
  })
  .strict();
export type AuthSession = z.infer<typeof authSessionSchema>;
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  factorId?: string;
  totpSecret?: string;
};
export type FormAction = (state: FormState, data: FormData) => Promise<FormState>;

export function safeNext(value: unknown, fallback = "/profile"): string {
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return fallback;
  const path = value.split(/[?#]/)[0];
  return [
    "/",
    "/recipes",
    "/my-fridge",
    "/meal-planner",
    "/shopping-list",
    "/favorites",
    "/assistant",
    "/profile",
    "/admin",
    "/auth/reset-password",
  ].includes(path ?? "")
    ? value
    : fallback;
}
