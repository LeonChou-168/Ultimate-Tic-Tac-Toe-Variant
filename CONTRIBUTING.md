# Contributing

Thanks for contributing to **Ultimate Tic-Tac-Toe Variant**.

## Before You Start

1. Read the main project overview in [`README.md`](README.md)
2. Check the documentation index in [`docs/README.md`](docs/README.md)
3. Review relevant specs under [`docs/specs/`](docs/specs/)

## Local Setup

```bash
npm install
npm run dev
```

## Validation

Before opening a pull request, run:

```bash
npm test
npm run build
```

## Contribution Guidelines

- Keep changes focused and easy to review
- Prefer small, isolated pull requests over large mixed changes
- Follow existing UI, engine, and file-organization patterns
- Do not remove files unless the change explicitly requires it
- If you reorganize files, update affected references in docs

## Documentation

If your change affects usage, structure, or behavior, update the relevant docs:

- `README.md` for user-facing setup or overview changes
- `docs/README.md` for documentation navigation changes
- `docs/specs/` for spec-level behavior or scope notes

## Pull Requests

Use the pull request template and include:

- A short summary of what changed
- Why the change was needed
- What verification you ran
