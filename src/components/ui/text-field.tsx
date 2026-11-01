"use client";

import { useId, type ComponentProps } from "react";

import { Input } from "./input";

export type TextFieldProps = ComponentProps<typeof Input> & { label: string; hint?: string; error?: string };

export function TextField({ label, hint, error, id, required, "aria-describedby": describedBy, "aria-invalid": invalid, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptions = [describedBy, hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">{label}{required && <span className="text-danger-foreground"> <span aria-hidden="true">*</span><span className="sr-only"> obligatoriu</span></span>}</label>
      <Input {...props} id={inputId} required={required} aria-invalid={error ? true : invalid} aria-describedby={descriptions} />
      {hint && <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
      {error && <p id={`${inputId}-error`} role="alert" className="text-sm text-danger-foreground">{error}</p>}
    </div>
  );
}
