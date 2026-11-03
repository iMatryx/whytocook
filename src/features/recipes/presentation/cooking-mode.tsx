"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cookingSessionSchema } from "../contracts/detail.schema";
import type { CookingSession } from "../contracts/detail.schema";
import {
  startTimer,
  pauseTimer,
  resetTimer,
  remainingMilliseconds,
  formatTimer,
} from "@/shared/presentation/cooking-timer";
import { createScreenAwake } from "@/shared/presentation/screen-awake";
import type { ScreenAwakeState } from "@/shared/presentation/screen-awake";
const awakeLabels: Record<ScreenAwakeState, string> = {
  off: "Ecranul urmează setările dispozitivului.",
  requesting: "Se solicită menținerea ecranului aprins…",
  active: "Ecranul este menținut aprins.",
  paused: "Menținerea ecranului este suspendată cât fila nu este vizibilă.",
  released: "Platforma a eliberat ecranul. Poți dezactiva și reactiva opțiunea.",
  denied: "Platforma nu a permis menținerea ecranului aprins.",
  unsupported: "Menținerea ecranului nu este disponibilă în acest browser sau context.",
};
export function CookingMode({
  visible,
  title,
  steps,
  timers,
  sessionKey,
  onClose,
  onFinish,
}: {
  visible: boolean;
  title: string;
  steps: string[];
  timers: (number | null)[];
  sessionKey: string;
  onClose: () => void;
  onFinish: () => void;
}) {
  const initial = useMemo<CookingSession>(
    () => ({
      version: 1,
      step: 0,
      timers: timers.map((seconds) => ({
        durationMs: (seconds ?? 300) * 1000,
        remainingMs: (seconds ?? 300) * 1000,
        deadlineMs: null,
      })),
    }),
    [timers],
  );
  const [session, setSession] = useState<CookingSession | null>(null),
    [warning, setWarning] = useState<string | null>(null),
    [now, setNow] = useState(0);
  const persist = useRef(true),
    heading = useRef<HTMLHeadingElement | null>(null);
  const [awake, setAwake] = useState<ScreenAwakeState>("off"),
    [enabled, setEnabled] = useState(false);
  const controller = useRef<ReturnType<typeof createScreenAwake> | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(sessionKey),
          stored = raw === null ? initial : cookingSessionSchema.parse(JSON.parse(raw));
        if (stored.timers.length !== steps.length || stored.step >= steps.length)
          throw new Error("Invalid progress");
        setSession(stored);
      } catch {
        persist.current = false;
        setWarning(
          "Progresul local nu poate fi citit. Lucrezi în memorie; datele vechi nu au fost înlocuite.",
        );
        setSession(initial);
      }
      setNow(Date.now());
    }, 0);
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [sessionKey, initial, steps.length]);
  useEffect(() => {
    const instance = createScreenAwake({
      supported: window.isSecureContext && "wakeLock" in navigator,
      isVisible: () => document.visibilityState === "visible",
      request: () => navigator.wakeLock.request("screen"),
      onState: setAwake,
    });
    controller.current = instance;
    const visibility = () => void instance.visibilityChanged();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      instance.dispose();
      controller.current = null;
    };
  }, []);
  function commit(next: CookingSession) {
    const checked = cookingSessionSchema.parse(next);
    if (persist.current)
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(checked));
      } catch {
        setWarning("Progresul rămâne numai în memorie; stocarea sesiunii nu este disponibilă.");
      }
    setSession(checked);
    setNow(Date.now());
  }
  function navigate(delta: number) {
    if (!session) return;
    commit({ ...session, step: Math.max(0, Math.min(steps.length - 1, session.step + delta)) });
    setTimeout(() => heading.current?.focus(), 0);
  }
  const step = session?.step ?? 0,
    current = session?.timers[step];
  function setDuration(form: HTMLFormElement) {
    if (!session) return;
    const fields = new FormData(form),
      seconds = Number(fields.get("minutes")) * 60 + Number(fields.get("seconds"));
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 604800) {
      setWarning("Alege o durată între 1 secundă și 7 zile.");
      return;
    }
    commit({
      ...session,
      timers: session.timers.map((timer, index) =>
        index === step
          ? { durationMs: seconds * 1000, remainingMs: seconds * 1000, deadlineMs: null }
          : timer,
      ),
    });
  }
  function changeTimer(action: "start" | "pause" | "reset", index = step) {
    if (!session) return;
    commit({
      ...session,
      timers: session.timers.map((timer, i) =>
        i !== index
          ? timer
          : action === "start"
            ? startTimer(timer, Date.now())
            : action === "pause"
              ? pauseTimer(timer, Date.now())
              : resetTimer(timer),
      ),
    });
  }
  return (
    <Dialog
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={`Cooking — ${title}`}
        description="Urmează pașii în ritmul tău. Navigarea și cronometrele nu modifică inventarul."
        className="max-w-4xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          setTimeout(() => heading.current?.focus(), 0);
        }}
      >
        {!session ? (
          <p role="status">Se încarcă progresul local…</p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium" role="status">
                Pasul {step + 1} din {steps.length}
              </p>
              <progress
                value={step + 1}
                max={steps.length}
                aria-label="Progres Cooking"
                className="h-3 w-full accent-primary"
              />
            </div>
            <section className="rounded-2xl bg-muted p-6 sm:p-9">
              <h3 ref={heading} tabIndex={-1} className="mb-5 font-display text-3xl outline-none">
                Pasul {step + 1}
              </h3>
              <p className="text-xl leading-relaxed sm:text-3xl sm:leading-relaxed">
                {steps[step]}
              </p>
            </section>
            <div className="flex flex-wrap justify-between gap-3">
              <Button
                size="lg"
                variant="outline"
                disabled={step === 0}
                onClick={() => navigate(-1)}
              >
                Pasul anterior
              </Button>
              {step < steps.length - 1 ? (
                <Button size="lg" onClick={() => navigate(1)}>
                  Pasul următor
                </Button>
              ) : (
                <Button size="lg" onClick={onFinish}>
                  Am gătit
                </Button>
              )}
            </div>
            {current && (
              <section className="rounded-xl border border-border p-5">
                <h4 className="font-semibold">Cronometru local pentru pasul {step + 1}</h4>
                <p className="my-3 text-4xl font-semibold tabular-nums" aria-live="off">
                  {formatTimer(remainingMilliseconds(current, now))}
                </p>
                <p role="status" className="text-sm text-muted-foreground">
                  {remainingMilliseconds(current, now) === 0
                    ? "Cronometrul s-a încheiat."
                    : current.deadlineMs === null
                      ? "Cronometrul este oprit."
                      : "Cronometrul rulează."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    onClick={() => changeTimer(current.deadlineMs === null ? "start" : "pause")}
                  >
                    {current.deadlineMs === null ? "Pornește cronometrul" : "Pauză cronometru"}
                  </Button>
                  <Button variant="outline" onClick={() => changeTimer("reset")}>
                    Resetează cronometrul
                  </Button>
                </div>
                <form
                  key={`${step}:${current.durationMs}`}
                  className="mt-4 flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setDuration(event.currentTarget);
                  }}
                >
                  <TextField
                    label={`Minute pas ${step + 1}`}
                    name="minutes"
                    type="number"
                    min="0"
                    max="10080"
                    defaultValue={Math.floor(current.durationMs / 60000)}
                  />
                  <TextField
                    label={`Secunde pas ${step + 1}`}
                    name="seconds"
                    type="number"
                    min="0"
                    max="59"
                    defaultValue={Math.floor((current.durationMs % 60000) / 1000)}
                  />
                  <Button variant="outline" type="submit">
                    Setează durata
                  </Button>
                </form>
              </section>
            )}
            {session.timers.some((timer, i) => i !== step && timer.deadlineMs !== null) && (
              <section>
                <h4 className="font-semibold">Alte cronometre</h4>
                <ul className="mt-2 space-y-2">
                  {session.timers.map((timer, i) =>
                    i !== step && timer.deadlineMs !== null ? (
                      <li
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-3 text-sm"
                      >
                        <span>
                          Pasul {i + 1}:{" "}
                          {remainingMilliseconds(timer, now) === 0
                            ? "Timp expirat"
                            : formatTimer(remainingMilliseconds(timer, now))}
                        </span>
                        <Button variant="outline" onClick={() => changeTimer("pause", i)}>
                          Oprește pasul {i + 1}
                        </Button>
                      </li>
                    ) : null,
                  )}
                </ul>
              </section>
            )}
            <section className="border-t border-border pt-5">
              <Button
                variant="outline"
                aria-pressed={enabled}
                disabled={awake === "requesting"}
                onClick={() => {
                  const next = !enabled;
                  setEnabled(next);
                  if (next) void controller.current?.enable();
                  else void controller.current?.disable();
                }}
              >
                {enabled ? "Dezactivează ecranul aprins" : "Menține ecranul aprins"}
              </Button>
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                {awakeLabels[awake]}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Cronometrele sunt locale. Browserul poate suspenda notificarea în fundal; verifică
                timpul la revenire.
              </p>
            </section>
            {warning && (
              <p role="alert" className="text-sm text-danger-foreground">
                {warning}
              </p>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                try {
                  sessionStorage.removeItem(sessionKey);
                  persist.current = true;
                  setWarning(null);
                } catch {
                  persist.current = false;
                  setWarning("Sesiunea nu poate fi salvată.");
                }
                commit(initial);
              }}
            >
              Reia pașii și cronometrele de la început
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
