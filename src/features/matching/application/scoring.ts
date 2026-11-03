import type { MatchingItem, MatchingRequest } from "../contracts/index.ts";

export function scoreRecipe(
  presenceBps: number,
  quantityBps: number,
  totalMinutes: number,
  tags: ReadonlySet<string>,
  preferences: MatchingRequest["preferences"],
): MatchingItem["score"] {
  const preferredMinutes = preferences.maxTotalMinutes;
  const timeBps =
    preferredMinutes === null || totalMinutes <= preferredMinutes
      ? 10000
      : Math.floor((preferredMinutes * 10000) / totalMinutes);
  const matchedTags = preferences.preferredTags.filter((tag) => tags.has(tag)).length;
  const preferenceBps = preferences.preferredTags.length
    ? Math.floor((matchedTags * 10000) / preferences.preferredTags.length)
    : 10000;
  const component = (bps: number, weight: number, explanation: string) => ({
    score: bps / 100,
    weight,
    points: Math.floor((bps * weight) / 100) / 100,
    explanation,
  });
  const components = {
    compatibility: component(
      presenceBps,
      50,
      "Prezența ingredientelor obligatorii, inclusiv cele care necesită măsurare.",
    ),
    quantities: component(
      quantityBps,
      30,
      "Media acoperirii cantităților obligatorii; fiecare linie este plafonată la 100%.",
    ),
    time: component(
      timeBps,
      10,
      preferredMinutes === null
        ? "Fără durată preferată: contribuție neutră."
        : `Durată ${totalMinutes} minute; preferință ${preferredMinutes} minute.`,
    ),
    preferences: component(
      preferenceBps,
      10,
      preferences.preferredTags.length
        ? `${matchedTags}/${preferences.preferredTags.length} etichete preferate prezente.`
        : "Fără etichete preferate: contribuție neutră.",
    ),
  };
  const totalBps = Object.values(components).reduce(
    (sum, c) => sum + Math.round(c.points * 100),
    0,
  );
  return { total: totalBps / 100, components };
}
