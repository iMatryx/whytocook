export class CatalogError extends Error {
  readonly code:
    "INVALID_QUERY" | "INVALID_CURSOR" | "CATALOG_CHANGED" | "NOT_FOUND" | "UNAVAILABLE";
  constructor(code: CatalogError["code"]) {
    super(code);
    this.name = "CatalogError";
    this.code = code;
  }
}
