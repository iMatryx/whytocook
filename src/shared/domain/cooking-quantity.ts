import { quantityMicros } from "./quantity.ts";

export const unitTable = {
  g: { base: "g", factor: 1n },
  kg: { base: "g", factor: 1000n },
  ml: { base: "ml", factor: 1n },
  l: { base: "ml", factor: 1000n },
  piece: { base: "piece", factor: 1n },
} as const;
export type SupportedUnit = keyof typeof unitTable;
export function supportedUnit(unit: string): unit is SupportedUnit {
  return Object.hasOwn(unitTable, unit);
}
export function baseMicros(quantity: string, unit: SupportedUnit) {
  return quantityMicros(quantity) * unitTable[unit].factor;
}
// Aggregate values may exceed the storage limit of an individual pantry lot.
export function displayMicros(value: bigint): string {
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${value / 1_000_000n}${fraction ? `.${fraction}` : ""}`;
}
export function scaleRequirement(
  base: bigint,
  unit: "g" | "ml" | "piece",
  portions: number,
  basePortions: number,
) {
  const numerator = base * BigInt(portions);
  const quantum = unit === "piece" ? 1_000_000n : 1n;
  const divisor = BigInt(basePortions) * quantum;
  return {
    required: ((numerator + divisor - 1n) / divisor) * quantum,
    rounding:
      numerator % divisor === 0n
        ? null
        : unit === "piece"
          ? ("whole_piece" as const)
          : ("up_to_micro_unit" as const),
  };
}
export function coverageBps(available: bigint, required: bigint) {
  return available >= required ? 10000 : Number((available * 10000n) / required);
}
