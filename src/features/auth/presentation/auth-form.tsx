"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, FormState } from "../contracts";

const initial: FormState = { status: "idle" };
export function AuthForm({
  action,
  mode,
  next = "/profile",
  tokenHash,
  type,
}: {
  action: FormAction;
  mode: "login" | "register" | "recover" | "resend" | "reset" | "confirm";
  next?: string;
  tokenHash?: string;
  type?: "email" | "recovery";
}) {
  const [state, submit, pending] = useActionState(action, initial);
  const email = ["login", "register", "recover", "resend"].includes(mode);
  const password = ["login", "register", "reset"].includes(mode);
  const labels = {
    login: "Intră în cont",
    register: "Creează contul",
    recover: "Trimite linkul de resetare",
    resend: "Retrimite confirmarea",
    reset: "Salvează parola nouă",
    confirm:
      type === "recovery" ? "Continuă resetarea parolei" : "Confirmă e-mailul și intră în cont",
  };
  return (
    <form action={submit} className="space-y-5" aria-busy={pending}>
      <input type="hidden" name="next" value={next} />
      {tokenHash && <input type="hidden" name="tokenHash" value={tokenHash} />}
      {type && <input type="hidden" name="type" value={type} />}
      {email && (
        <TextField
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          error={state.fieldErrors?.email?.[0]}
        />
      )}
      {password && (
        <TextField
          name="password"
          label={mode === "reset" ? "Parolă nouă" : "Parolă"}
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "login" ? 1 : 12}
          maxLength={128}
          hint={mode === "login" ? undefined : "Minimum 12 caractere."}
          error={state.fieldErrors?.password?.[0]}
        />
      )}
      {(mode === "register" || mode === "reset") && (
        <TextField
          name="confirmPassword"
          label="Confirmă parola"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          error={state.fieldErrors?.confirmPassword?.[0]}
        />
      )}
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "rounded-md bg-danger p-3 text-sm text-danger-foreground"
              : "rounded-md bg-accent p-3 text-sm text-accent-foreground"
          }
        >
          {state.message}
        </p>
      )}
      <Button type="submit" loading={pending} size="lg" className="w-full">
        {pending ? "Se procesează…" : labels[mode]}
      </Button>
      {mode === "login" && (
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <Link className="underline underline-offset-4" href="/forgot-password">
            Ai uitat parola?
          </Link>
          <Link className="underline underline-offset-4" href="/register">
            Creează un cont
          </Link>
        </div>
      )}
      {mode !== "login" && (
        <p className="text-sm text-muted-foreground">
          <Link className="underline underline-offset-4" href="/login">
            Înapoi la autentificare
          </Link>
        </p>
      )}
    </form>
  );
}
