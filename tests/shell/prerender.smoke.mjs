import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Auth makes the shared header request-dependent. Check the privacy invariant
// instead of pretending that private pages still have static HTML to inspect.
const manifest = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
const pages = JSON.parse(readFileSync(".next/server/app-paths-manifest.json", "utf8"));
for (const route of [
  "my-fridge",
  "meal-planner",
  "shopping-list",
  "favorites",
  "assistant",
  "profile",
  "admin",
  "auth/reset-password",
  "auth/mfa",
]) {
  assert.equal(manifest.routes[`/${route}`], undefined, `/${route} must not be prerendered`);
  assert.equal(
    existsSync(`.next/server/app/${route}.html`),
    false,
    `/${route} must not publish static private HTML`,
  );
  assert.ok(pages[`/(shell)/${route}/page`], `/${route} has a built server route`);
  console.log(`PASS /${route}: dynamic route, no static private HTML`);
}
for (const route of ["recipes", "login", "register", "forgot-password"]) {
  assert.ok(pages[`/(shell)/${route}/page`]);
}
console.log(
  "Manifest/privacy checks only; authenticated rendering and HTTP/browser flows require live integration tests.",
);
