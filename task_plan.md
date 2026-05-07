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
| 11. Add volume + claim polish | complete | Add sound-volume control and a stronger captured-board visual burst effect. |
| 12. Add tutorial auto-follow + history + endgame summary | complete | Advance all three next M2 UX directions in one coordinated pass. |
| 13. Redesign shell + replay + AI mode | complete | Add welcome/menu flow, board-first gameplay shell with hover-reveal sidebar, replay mode, and initial human-vs-AI mode. |
| 14. Tighten board/sidebar play layout | complete | Remove rejected copy and bring board + sidebar closer together for actual play comfort. |
| 15. Compress sidebar further | complete | Shrink the sidebar and place it more directly on the board’s right side for play-first density. |
| 16. Add compact rail sidebar mode | complete | Make the default sidebar a narrow right rail that expands into the full panel on hover or click. |
| 17. Fix right-rail anchoring bug | complete | Correct the sidebar placement bug by anchoring the rail to the shell’s right edge. |
| 18. Verify sidebar bug in browser | complete | Use browser evidence to confirm the sidebar truly sits to the board’s right instead of below it. |
| 19. HUD micro-polish pass | complete | Make the compact rail more HUD-like and smooth the expanded drawer motion. |
| 20. Speed up AI turns | complete | Reduce the artificial UI delay so human-vs-AI mode responds faster. |
| 21. Remove replay copy + fix highlight | complete | Delete the unwanted replay explanatory copy and restore correct live target highlighting. |
| 22. Scope tutorial gold border | complete | Move the tutorial focus ring from the outer board region to the inner board frame. |
| 23. Restrict gold to playable boards only | complete | Remove board-frame gold focus so only legal small-board targets remain highlighted in gold. |
| 24. Switch AI to ultra-fast mode | complete | Remove the remaining artificial AI delay so moves happen immediately. |
| 25. Multi-level sidebar + stop auto-pop | complete | Convert the sidebar to the confirmed 5-section layered structure and stop fade mode from reopening on every move. |
| 26. HUD-style sidebar polish | complete | Make the first-layer entries denser and more HUD-like, and smooth the detail-view reveal. |
| 27. Remove first-layer titles | complete | Delete the visible “词条” heading and the visible category titles from the first-layer entry list. |
| 28. Simplify back-to-list control | complete | Make the top “返回词条” control more minimal while keeping the same behavior. |
| 29. Add board coordinates + coordinate copy | complete | Add the requested board coordinate system and update battle/replay microcopy accordingly. |
| 30. Unify coordinate notation + horizontal strip | complete | Standardize coordinate style, strengthen battlefield coordinate linkage, and make the three status modules horizontal. |
| 31. Dedicated status-strip layout | complete | Ensure 当前战场 / 主动结算 / 求和次数 use their own explicit horizontal layout hook. |
| 32. Tighten status-strip sizing | complete | Make the three horizontal status cards compact enough to read as one row inside the sidebar. |
| 33. Correct status-card interpretation | complete | Change the three 对局状态 modules into horizontal-style cards stacked vertically. |
| 34. Motion choreography polish | complete | Make page/sidebar transitions calmer with layered reveals and left-to-right content entrances. |
| 35. Finer motion staggering | complete | Separate title/body/actions more clearly and strengthen left-to-right reveal timing. |
| 36. Landing-stage transition handoff | complete | Replace the hard welcome/menu screen swap with a persistent landing stage and outgoing/incoming transition choreography. |
| 37. Background + press-beat + sidebar entry motion | complete | Add landing background breathing, button press/release before navigation, and right-to-left sidebar entrance on game start. |
| 38. High-fidelity landing/game entry motion | complete | Add per-character landing text reveal, stronger directional light-field split, and a subtle board settle-in on game start. |
| 39. Landing composition rebalance | complete | Make non-game pages more harmonious, reduce eye strain, and split character cadence by content role. |

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
