export type CookingTimer = { durationMs: number; remainingMs: number; deadlineMs: number | null };
export function remainingMilliseconds(timer: CookingTimer, now: number) {
  return Math.max(
    0,
    Math.min(
      timer.remainingMs,
      timer.deadlineMs === null ? timer.remainingMs : timer.deadlineMs - now,
    ),
  );
}
export function startTimer(timer: CookingTimer, now: number): CookingTimer {
  return timer.deadlineMs === null
    ? { ...timer, deadlineMs: now + timer.remainingMs }
    : { ...timer };
}
export function pauseTimer(timer: CookingTimer, now: number): CookingTimer {
  return { ...timer, remainingMs: remainingMilliseconds(timer, now), deadlineMs: null };
}
export function resetTimer(timer: CookingTimer): CookingTimer {
  return { durationMs: timer.durationMs, remainingMs: timer.durationMs, deadlineMs: null };
}
export function formatTimer(milliseconds: number) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000),
    h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
