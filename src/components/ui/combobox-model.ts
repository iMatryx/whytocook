export type ComboboxOption = { value: string; label: string; disabled?: boolean };

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLocaleLowerCase("ro");
}

export function filterOptions(options: readonly ComboboxOption[], query: string): readonly ComboboxOption[] {
  const normalized = normalize(query);
  return options.filter((option) => normalize(option.label).includes(normalized));
}

export function nextEnabledIndex(options: readonly ComboboxOption[], current: number, direction: 1 | -1): number {
  if (!options.length) return -1;
  let index = current < 0 ? (direction === 1 ? -1 : 0) : current;
  for (let count = 0; count < options.length; count += 1) {
    index = (index + direction + options.length) % options.length;
    if (options[index] && !options[index].disabled) return index;
  }
  return -1;
}
