# Cookly — UI kit implementation plan

Stage 2, design system only. Implements the user's requested reusable React UI without inventory, recipe search, authentication, matching calculations or persistence.

## Direction and constraints

- Preserve the existing foundation and its homepage. Add a noindex `/ui-kit` reference route.
- Palette: parsley `#24563d`, porcelain `#fbfcfa`, ink `#202c24`, mint `#e7eee8`, lemon `#fff3c4`; semantic success/warning/danger/info tokens in both themes.
- Type: system sans for controls and body, Georgia for editorial display only; no font network dependency. Sentence case, left alignment and 65–75 character reading measures.
- Layout: quiet page chrome, a spacious editorial intro, then reference sections; four/six/twelve-column guidance, actual one/two/three-column card examples. Controls at least 40 px tall.
- Use the established shadcn Button and composition helper; extend existing tokens rather than creating a parallel stylesheet or icon package.
- Three justified dependencies: Radix Dialog for focus trapping/Escape/focus restoration in modal and drawer, Radix Popover for positioned combobox suggestions, Sonner for accessible toast delivery. No cmdk, Vaul, Storybook or additional state manager.
- Recipe cards and compatibility badges render caller-provided data. They do not calculate whether a recipe is safe or feasible.
- Modern culinary identity comes from restrained green, an editorial type scale and original local SVG plate illustrations; no decorative gradients or invented live data.

## Work

- [x] First write failing native tests for combobox filtering/disabled keyboard traversal and compatibility labels.
- [x] Extend tokens, Button variants and reusable Input/Textarea/TextField, Tag/Chip/Badge, Skeleton and feedback components.
- [x] Implement keyboard combobox, modal/drawer, toast and responsive navigation using the justified primitives.
- [x] Build recipe cards with optional media/favorite interactions, loading and missing-data presentation.
- [x] Add `/ui-kit` gallery with real demonstrations of keyboard selection, dialogs, drawer, toast, state examples and responsive cards.
- [x] Document props, variants, composition examples, type/spacing/grid/breakpoints and limitations in `docs/design/DESIGN-SYSTEM.md`.
- [ ] Run native tests and token contrast checks; install dependencies and run lint/typecheck/build/browser tests if registry approval permits. Never report unexecuted checks as passing.
- [ ] Fresh review, resolve important findings and record exact verification/file changes.

## Execution notes

- Baseline is commit `8b4b604`; worktree clean at inspection. No `node_modules` or pnpm lockfile exists from the preceding stage.
- Corepack registry request failed with ENOTFOUND inside sandbox; escalated `corepack pnpm --version` is awaiting approval. This remains a dependency of executable Next.js verification.

- Native verification: 14/14 passed (6 UI/token checks and 8 import checks). Static review fixes applied. Dependency installation and full executable checks remain pending approval; no completion claim for browser/build.
