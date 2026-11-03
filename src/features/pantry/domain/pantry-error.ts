export class PantryError extends Error {
  readonly code:
    | "INVALID_INPUT"
    | "NOT_FOUND"
    | "CONFLICT"
    | "INSUFFICIENT_STOCK"
    | "CAPACITY"
    | "UNAVAILABLE"
    | "SESSION_CHANGED";
  constructor(code: PantryError["code"]) {
    super(code);
    this.name = "PantryError";
    this.code = code;
  }
}
