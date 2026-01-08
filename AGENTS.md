# Repository Guidelines

## Project Structure and Module Organization
- `src/` holds the React + TypeScript frontend.
  - `src/components/`, `src/hooks/`, `src/utils/`, `src/types/` split UI, hooks, helpers, and shared types.
  - `src/App.tsx` and `src/main.tsx` are the app entry points.
- `src-tauri/` contains the Rust Tauri app and configuration.
- `public/` hosts static files served by Vite.
- `assets/` stores screenshots and documentation images.
- `dist/` is the generated web build output.

## Build, Test, and Development Commands
Use pnpm (preferred) or npm/yarn equivalents.
- `pnpm install` installs dependencies.
- `pnpm dev` starts the Vite dev server for the web UI.
- `pnpm tauri dev` runs the desktop app in dev mode.
- `pnpm build` runs TypeScript typecheck and builds the web assets.
- `pnpm preview` serves the built web app locally.
- `pnpm tauri build` creates a production desktop build.
- `pnpm format`, `pnpm format:check`, `pnpm lint`, `pnpm stylelint` format and lint the codebase.

## Coding Style and Naming Conventions
- Indentation is 2 spaces; use single quotes and semicolons (Prettier).
- Keep React components in PascalCase (e.g. `EditorPane.tsx`) and hooks in `useX` format.
- Prefer small, focused modules under `src/utils/` with camelCase exports.
- Run Prettier, ESLint, and Stylelint before opening a PR.

## Testing Guidelines
- No automated test runner is configured yet and there is no `tests/` directory.
- Validate changes manually with `pnpm dev` and, when relevant, `pnpm tauri dev`.
- If you add tests later, document the runner and add a script in `package.json`.

## Commit and Pull Request Guidelines
- Use Conventional Commits with these types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.
- Keep subjects short and imperative; include scope only when helpful.
- PRs should include a clear summary, testing steps, linked issues, and UI screenshots for visual changes.
- Mention platform-specific checks if your change affects Tauri packaging.
