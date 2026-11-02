"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { FormAction, FormState } from "../contracts";

const initial: FormState = { status: "idle" };
export function MfaForm({
  enrollAction,
  verifyAction,
  factorId,
  next,
}: {
  enrollAction: FormAction;
  verifyAction: FormAction;
  factorId?: string;
  next: string;
}) {
  const [enrollment, enroll, enrolling] = useActionState(enrollAction, initial);
  const [state, verify, pending] = useActionState(verifyAction, initial);
  const selected = factorId ?? enrollment.factorId;
  return (
    <div className="space-y-6">
      {!selected && (
        <form action={enroll}>
          <Button type="submit" loading={enrolling}>
            Configurează aplicația de autentificare
          </Button>
        </form>
      )}
      {enrollment.totpSecret && (
        <div className="rounded-lg bg-accent p-4">
          <p className="mb-3 text-sm">Adaugă această cheie în aplicația de autentificare:</p>
          <code className="break-all font-mono text-sm">{enrollment.totpSecret}</code>
        </div>
      )}
      {enrollment.status === "error" && (
        <p role="alert" className="text-danger-foreground">
          {enrollment.message}
        </p>
      )}
      {selected && (
        <form action={verify} className="space-y-5">
          <input type="hidden" name="factorId" value={selected} />
          <input type="hidden" name="next" value={next} />
          <TextField
            name="code"
            label="Cod din aplicația de autentificare"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            minLength={6}
            autoComplete="one-time-code"
            error={state.fieldErrors?.code?.[0]}
          />
          {state.message && (
            <p role="alert" className="text-sm text-danger-foreground">
              {state.message}
            </p>
          )}
          <Button type="submit" loading={pending}>
            Verifică și continuă
          </Button>
        </form>
      )}
    </div>
  );
}
