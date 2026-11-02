// Match the immutable SQL function exactly. Do not remove Cyrillic combining
// marks globally: that would incorrectly merge й and и.
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
