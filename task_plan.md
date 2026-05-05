# Ultimate Tic-Tac-Toe Variant Task Plan

## Goal
Implement the requirements from `/Users/zhouchenlong/Desktop/Ultimate Tic-Tac-Toe Variant 规格说明书.md` into the project and verify the result.

## Phases

| Phase | Status | Objective |
|---|---|---|
| 1. Restore/initialize planning context | complete | Create persistent planning files and recover any prior state. |
| 2. Understand spec and project | complete | Read the Chinese specification and map it to the current codebase. |
| 3. Explore implementation patterns | complete | Use direct tools and background agents to identify architecture, files, and relevant patterns. |
| 4. Implement requirements | complete | Bootstrap the app, implement core game rules, tests, and playable UI. |
| 5. Verify | complete | Run diagnostics, tests, typecheck, and build where available. |
| 6. Revise specification document | complete | Recover prior doc requirements, assess current draft, and append missing clarifications without deleting prior content. |
| 7. Implement M2 interaction milestone | complete | Improve game-state clarity, invalid-action feedback, and action availability messaging in the local web UI. |
| 8. Continue M2 onboarding/settings | complete | Add newcomer guidance, in-game settings toggles, and remove visible board numbering from the board UI. |
| 9. Add step-by-step tutorial | complete | Convert static onboarding into a guided, progressive tutorial with highlighted focus areas. |
| 10. Add real sound feedback | complete | Implement lightweight synthesized game audio and connect it to the in-game sound toggle. |

## Decisions

- Treat the Chinese specification as the source of truth.
- Planning files live in the project root, not the skill directory.
- Bootstrap a frontend-first React/Vite app because the repository initially had no complete runnable scaffold.
- Keep game rules in `src/game` as pure TypeScript so UI, future online mode, and future AI mode can share one source of truth.
- Implement manual settlement by detecting boards where neither player can still complete any three-in-a-row, not only completely full boards.
- Document local startup in `README.md` and put multiplayer-server implementation guidance in a separate doc to keep setup instructions short and the backend roadmap detailed.
- Expose a global developer command through npm `bin` and `npm link`, so terminal usage stays aligned with the existing npm scripts.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Explore/background agents failed with `Missing Authentication header` | 1 | Continue with direct repository tools and log the limitation. |
| LSP diagnostics unavailable because `typescript-language-server` is not installed | 1 | Used `npm test` and `npm run build` as concrete verification. |
| Initial build surfaced strict TypeScript/config issues | 1 | Added defensive board indexing and used Vitest config typing; build now passes. |
| Browser smoke testing could not run because Playwright is not installed | 1 | Verified with Vitest and production build; documented the limitation. |
