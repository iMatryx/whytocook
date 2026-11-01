import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const css = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const luminance = (hex) => {
  const channels = hex.slice(1).match(/../g).map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

describe("semantic color contrast", () => {
  for (const selector of [":root", ".dark"]) {
    it(`${selector} text tokens meet 4.5:1 and input boundaries meet 3:1`, () => {
      const block = css.slice(css.indexOf(`${selector} {`)).split("}")[0];
      const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map((match) => [match[1], match[2]]));
      const contrast = (a, b) => {
        assert.ok(tokens[a] && tokens[b], `Missing ${a}/${b}`);
        const values = [luminance(tokens[a]), luminance(tokens[b])].sort((x, y) => y - x);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      for (const [foreground, background] of [["foreground", "background"], ["card-foreground", "card"], ["muted-foreground", "background"], ["muted-foreground", "muted"], ["primary-foreground", "primary"], ["success-foreground", "success"], ["warning-foreground", "warning"], ["danger-foreground", "danger"], ["info-foreground", "info"]]) {
        assert.ok(contrast(foreground, background) >= 4.5, `${foreground}/${background} below 4.5`);
      }
      assert.ok(contrast("input", "background") >= 3, "Input boundary below 3");
    });
  }
});
