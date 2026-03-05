# Contributing to LiteMark

This project is currently under phased refactor. Contributions are welcome, but please follow the process to keep changes safe and reversible.

## 1. Development Setup

Requirements:
1. Node.js 20+
2. pnpm 10+
3. Rust stable (for Tauri)

Install:

```bash
pnpm install
```

Run frontend:

```bash
pnpm dev
```

Run desktop app:

```bash
pnpm tauri dev
```

## 2. Quality Gates

Before opening a PR, run:

```bash
pnpm lint
pnpm stylelint
pnpm build
```

## 3. Branch and Commit Rules

1. Branch naming: `feat/*`, `fix/*`, `refactor/*`, `docs/*`.
2. Prefer small PRs by scope (one feature area per PR).
3. Use conventional commits, for example:
   - `refactor(preview): extract markdown pipeline`
   - `feat(ui): migrate settings panel to shadcn sheet`

## 4. Refactor Constraints

1. No big-bang rewrite.
2. Every major change must include:
   - change list
   - risk and rollback plan
   - test list
   - acceptance criteria
3. Keep docs and code updated together.
4. Do not remove legacy path until replacement passes acceptance.

## 5. Project Docs

Please read before large changes:
1. [docs/重构路线图.md](./docs/重构路线图.md)
2. [docs/组件迁移清单.md](./docs/组件迁移清单.md)
3. [docs/Markdown重构设计.md](./docs/Markdown重构设计.md)
4. [docs/性能与Rust迁移报告.md](./docs/性能与Rust迁移报告.md)
5. [docs/架构说明.md](./docs/架构说明.md)

## 6. Testing Expectations

1. Add/update unit tests for affected logic.
2. Add integration tests for mode-switch and markdown rendering changes.
3. For Rust changes, include benchmark comparison and fallback behavior.

## 7. Pull Request Checklist

1. Scope is clear and limited.
2. Build/lint passed.
3. Docs updated.
4. Rollback path described.
5. Screenshots attached for UI changes.

## 8. Security Notes

Markdown-related PRs must include XSS regression checks. Avoid enabling raw HTML rendering without sanitize policy and explicit review.
