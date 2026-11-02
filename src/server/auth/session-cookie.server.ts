import "server-only";

export function expiredSessionCookie(name: string) {
  return {
    name,
    value: "",
    httpOnly: true,
    secure: name.startsWith("__Host-"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
