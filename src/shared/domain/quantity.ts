const scale = 1_000_000n;
const units: Record<string, { dimension: string; factor: bigint }> = {
  g: { dimension: "mass", factor: 1n },
  kg: { dimension: "mass", factor: 1000n },
  ml: { dimension: "volume", factor: 1n },
  l: { dimension: "volume", factor: 1000n },
  piece: { dimension: "count", factor: 1n },
};
export function quantityMicros(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value))
    throw new Error("Cantitate invalidă. Folosește cel mult 6 zecimale.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * scale + BigInt(fraction.padEnd(6, "0"));
}
export function quantityText(value: bigint): string {
  if (value < 0n || value >= 1_000_000_000_000n * scale)
    throw new Error("Cantitatea depășește limita permisă.");
  const fraction = (value % scale).toString().padStart(6, "0").replace(/0+$/, "");
  return `${value / scale}${fraction ? `.${fraction}` : ""}`;
}
export function convertQuantity(value: string, from: string, to: string): string {
  const a = units[from],
    b = units[to];
  if (!a || !b || a.dimension !== b.dimension)
    throw new Error("Unitățile nu pot fi convertite în siguranță.");
  const micros = quantityMicros(value);
  if (a.dimension === "count" && micros % scale !== 0n)
    throw new Error("Bucățile trebuie să fie întregi.");
  const result = micros * a.factor;
  if (result % b.factor !== 0n)
    throw new Error("Conversia ar necesita rotunjire. Păstrează unitatea inițială.");
  return quantityText(result / b.factor);
}
