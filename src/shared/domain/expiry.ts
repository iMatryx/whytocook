export type ExpiryStatus = "unknown" | "expired" | "today" | "soon" | "fresh";
export function expiryStatus(expiresOn: string | null, today: string): ExpiryStatus {
  if (!expiresOn) return "unknown";
  const days = (Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  if (!Number.isFinite(days)) throw new Error("Dată invalidă.");
  return days < 0 ? "expired" : days === 0 ? "today" : days <= 3 ? "soon" : "fresh";
}
export function localCalendarDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
