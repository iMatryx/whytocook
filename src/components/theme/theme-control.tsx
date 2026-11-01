"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ThemeControl() {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="interface-theme" className="text-sm text-muted-foreground">Temă</label>
      <select
        id="interface-theme"
        aria-label="Tema interfeței"
        value={mounted ? theme : "system"}
        disabled={!mounted}
        onChange={(event) => setTheme(event.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <option value="system">Sistem</option>
        <option value="light">Luminoasă</option>
        <option value="dark">Întunecată</option>
      </select>
    </div>
  );
}
