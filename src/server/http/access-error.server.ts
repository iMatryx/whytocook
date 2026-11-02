import "server-only";

const errors = {
  AUTH_REQUIRED: { status: 401, message: "Autentificarea este necesară." },
  FORBIDDEN: { status: 403, message: "Acces nepermis." },
  MFA_REQUIRED: { status: 403, message: "Este necesară autentificarea în doi pași." },
  RESOURCE_NOT_FOUND: { status: 404, message: "Resursa nu este disponibilă." },
  INVALID_RESOURCE: { status: 400, message: "Resursă invalidă." },
  ACCESS_UNAVAILABLE: {
    status: 503,
    message: "Verificarea accesului este temporar indisponibilă.",
  },
} as const;

export class AccessError extends Error {
  readonly code: keyof typeof errors;
  readonly status: number;
  constructor(code: keyof typeof errors) {
    super(errors[code].message);
    this.name = "AccessError";
    this.code = code;
    this.status = errors[code].status;
  }
}
