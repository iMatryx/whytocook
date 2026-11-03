export class RecipeSearchError extends Error {
  constructor(
    readonly code:
      "INVALID_REQUEST" | "UNAVAILABLE" | "CAPACITY" | "SESSION_CHANGED" | "NOT_FOUND" | "CONFLICT",
  ) {
    super(code);
    this.name = "RecipeSearchError";
  }
}
