import type { ComponentProps } from "react";

const paths = {
  home: "m3 10 9-7 9 7v11h-7v-7h-4v7H3V10Z",
  book: "M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3V3Z",
  fridge: "M5 3h14v18H5V3ZM5 10h14M8 6v2M8 13v3",
  calendar: "M4 5h16v16H4V5ZM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 18h2",
  basket: "m3 9 2 12h14l2-12H3ZM8 9l4-7 4 7M9 13v4M15 13v4",
  sparkles: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4",
  user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  settings: "M4 7h16M4 17h16M9 4v6M15 14v6",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  chevron: "m6 9 6 6 6-6",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  leaf: "M20 4c-1 8-5 15-12 13-7-3-1-12 12-13ZM4 20 16 8",
  alert: "M12 8v4M12 16h.01M12 2 1 21h22L12 2Z",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  info: "M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, ...props }: ComponentProps<"svg"> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
