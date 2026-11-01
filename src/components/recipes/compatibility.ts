export const compatibilityLabels = {
  ready: "Poți găti",
  "check-quantities": "Verifică cantitățile",
  missing: "Ingrediente lipsă",
} as const;

export type CompatibilityStatus = keyof typeof compatibilityLabels;
