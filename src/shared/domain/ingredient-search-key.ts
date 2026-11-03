// Shared exact-alias normalization, identical to the ingredient SQL search key.
// Keep Cyrillic й distinct from и; normalize only the documented RO/RU variants.
export function ingredientSearchKey(value: string): string {
  const romanian: Readonly<Record<string, string>> = {
    ă: "a",
    â: "a",
    î: "i",
    ș: "s",
    ş: "s",
    ț: "t",
    ţ: "t",
  };
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[ăâîșşțţ]/g, (letter) => romanian[letter] ?? letter)
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/g, " ")
    .trim();
}
