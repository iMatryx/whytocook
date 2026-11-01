import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterOptions, nextEnabledIndex } from "../../src/components/ui/combobox-model.ts";
import { compatibilityLabels } from "../../src/components/recipes/compatibility.ts";

const options = [
  { value: "tomato", label: "Roșii" },
  { value: "spinach", label: "Spanac", disabled: true },
  { value: "egg", label: "Ouă" },
];

describe("combobox presentation", () => {
  it("filters case and diacritics without changing canonical values", () => {
    assert.deepEqual(filterOptions(options, "  ROSII "), [options[0]]);
    assert.deepEqual(filterOptions(options, "oua"), [options[2]]);
    assert.deepEqual(filterOptions(options, ""), options);
    assert.deepEqual(filterOptions(options, "lapte"), []);
  });
  it("wraps keyboard navigation and skips disabled options", () => {
    assert.equal(nextEnabledIndex(options, -1, 1), 0);
    assert.equal(nextEnabledIndex(options, 0, 1), 2);
    assert.equal(nextEnabledIndex(options, 2, 1), 0);
    assert.equal(nextEnabledIndex(options, -1, -1), 2);
    assert.equal(nextEnabledIndex(options, 0, -1), 2);
  });
  it("has no active option when there is nothing selectable", () => {
    assert.equal(nextEnabledIndex([], -1, 1), -1);
    assert.equal(nextEnabledIndex([{ value: "x", label: "X", disabled: true }], 0, 1), -1);
  });
});

describe("compatibility presentation", () => {
  it("distinguishes verified quantities, unknown quantities and missing ingredients", () => {
    assert.equal(compatibilityLabels.ready, "Poți găti");
    assert.equal(compatibilityLabels["check-quantities"], "Verifică cantitățile");
    assert.equal(compatibilityLabels.missing, "Ingrediente lipsă");
  });
});
