# Repository Guidelines

## Project Structure & Module Organization

- `src/`: Vue 3 + TypeScript application code.
  - `src/components/`: shared UI components (e.g., `ComparePanel.vue`).
  - `src/views/`: route-level views.
  - `src/router/`, `src/stores/`, `src/utils/`, `src/types/`: app wiring and utilities.
  - `src/adapters/`: Element Plus / table adapter implementations (`.ts`/`.tsx`).
  - `src/mock/`: local mock data/helpers.
- `public/`: static assets served as-is.
- `doc/`: project notes and documentation.
- `dist/`: production build output (generated; do not edit by hand).

## Build, Test, and Development Commands

Use `pnpm` (see `package.json` for the required Node version).

- `pnpm install`: install dependencies.
- `pnpm dev`: start the Vite dev server.
- `pnpm build`: run `pnpm type-check` + `pnpm build-only` in parallel.
- `pnpm preview`: serve the built app locally.
- `pnpm type-check`: run `vue-tsc`.
- `pnpm lint`: ESLint (auto-fixes and caches).
- `pnpm lint:style`: Stylelint for CSS/Vue/HTML.
- `pnpm format`: Prettier write pass for `src/`.

## Coding Style & Naming Conventions

- Indentation: 2 spaces; EOL: LF; UTF-8 (`.editorconfig`).
- Prettier: single quotes, no semicolons, `printWidth: 100` (`.prettierrc.json`).
- Linting: ESLint (Vue + TS) and Stylelint configs live at repo root.
- Naming: Vue SFCs in `PascalCase.vue`; TS/TSX modules in `camelCase.ts(x)`.

## Testing Guidelines

No dedicated test runner is configured yet. Before opening a PR, rely on:

- `pnpm type-check`, `pnpm lint`, `pnpm lint:style`, and a quick manual check via `pnpm dev`.

## Commit & Pull Request Guidelines

- Conventional Commits are enforced via Husky + Commitlint (`type(scope): subject`, max 95 chars).
  - Allowed `type`: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`, `build`.
- Prefer `pnpm commit` (Commitizen) to generate compliant messages.
- PRs: describe the change, link issues, and include screenshots for UI changes.
