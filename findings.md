# Findings

## Research Log

- Planning files were not present at session start; initialized fresh files.
- Background explore agents were attempted for engine mapping, rule comparison, and verification command discovery, but all failed immediately with `Missing Authentication header`; proceeded with direct repository tools.

## Specification Notes

- Spec source: `/Users/zhouchenlong/Desktop/Ultimate Tic-Tac-Toe Variant 规格说明书.md`.
- P0/P1 game-core rules include: first move anywhere, subsequent projection to previous cell index, free play when projected board is occupied, occupied small boards forbid further moves, automatic settlement when no unoccupied board has empty cells, manual settlement when every unoccupied board can no longer produce a winner, occupied-board count decides winner, resignation, and up to three draw offers per side.
- Visual/online/backend requirements are broader than this first milestone; current implementation covers a frontend-first local-play app and reusable core game logic.

## Codebase Notes

- Implemented files include Vite/React scaffold, `src/App.tsx`, `src/styles.css`, `src/main.tsx`, and reusable game logic under `src/game/`.
- Existing engine already models players, cells, board winners, game status, settlement, draw offers, legal boards, move placement, resignation, and draw response.
- Tooling now uses Vite, React, TypeScript, and Vitest with `npm test` and `npm run build` scripts.
- Tooling now also exposes a lightweight global CLI command (`uttv`) via npm `bin` + `npm link`.
- Main gap found: `canManualSettle` only returns true when every unoccupied board is full. The spec allows manual settlement once every unoccupied board is a drawn/dead board that cannot produce a winner, even before it is fully occupied.
- Later full root listing showed Vite/React project scaffolding (`package.json`, `index.html`, `vite.config.ts`, `src/App.tsx`, etc.) and existing npm scripts.
- `src/App.tsx` already routes the “主动结算” button through `settleGame`, so the engine correction is automatically exposed in the UI.
- Documentation now includes a repo-root `README.md` for local startup and a dedicated `docs/联机服务器教程.md` for adding a future Socket.io-based multiplayer backend.

## Visual Direction Implemented

- CSS-only first milestone with dark walnut board, beveled small boards, legal target glow, last-move blue glow, and black/white glossy yunzi-like stones.
- Responsive layout switches from side-by-side desktop board/status panel to stacked mobile layout.

## Spec Revision Notes

- Recovered prior doc-improvement intent from session history: user previously wanted additive-only enhancement, clearer rule wording, stronger technical breakdown, checklist-style feature list, clearer acceptance criteria, and milestone guidance.
- Current spec draft is broad but still benefits from explicit separation between target-state planning and the repository's already-implemented first milestone.
- Best additive improvement is to append clarifying sections rather than rewrite earlier chapters: current repository scope, rule edge-case clarifications, state machine/interaction constraints, server-authoritative multiplayer constraints, concrete test coverage expectations, and milestone redefinition.

## M2 Interaction Milestone Findings

- The current repo already satisfies the first runnable M1 scope; the highest-value next step is improved usability and state visibility rather than backend multiplayer.
- Existing board buttons used native `disabled`, which suppressed click events and prevented explicit invalid-action feedback. Replacing that with `aria-disabled` on cells allows the engine to explain illegal clicks while preserving styling and accessibility cues.
- `placeMove` benefited from more granular illegal-move messages: occupied board, full board, occupied cell, ended game, and forced target board can now be distinguished in the UI.
- The spec's interaction requirements map well to a compact HUD: current player, target/free-move state, last move, draw-offer state, remaining draw offers, and settlement readiness.
- The next cohesive M2 slice after HUD clarity is lightweight onboarding plus user-controlled information density, not heavier feature work.
- Removing visible board index labels makes the board feel cleaner, so guidance must move into surrounding copy and panels instead of living on the board itself.
- A small settings panel can be meaningful even before real audio exists by establishing stable interaction points and future extension hooks.
- The natural continuation after static onboarding is a guided flow that teaches players where to look in order: status feedback, battlefield guidance, the highlighted board, then action controls.
- A lightweight tutorial can be implemented without measuring DOM geometry by using section-level highlight states and a synchronized step panel; this keeps the code simple and reliable while still feeling guided.
- Real audio can be added without external assets or new dependencies by using Web Audio API synthesis; this avoids bundling sound files while still giving distinct UX feedback.
- The most reliable hook point for sound is the UI event layer in `App.tsx`, because it already sees user intent plus the engine result and can distinguish move, invalid action, claim, settlement, draw flow, and resignation.
- Volume control fits best as a master multiplier inside the audio envelope utility rather than duplicating scaling logic across each cue.
- A claim celebration effect can stay purely in the UI by diffing previous vs next `boardWinners`, which avoids changing the engine API and still gives precise one-shot animation on newly occupied boards.
- Tutorial auto-follow can be driven from coarse game milestones (`history.length`, pending draw state, manual settlement availability, and game end) without introducing a separate tutorial state machine.
- A recent-move panel is a high-value way to teach the projection rule because it exposes concrete board/cell sequences instead of abstract explanations.
- Richer endgame presentation works best as a dedicated summary panel that explains *why* the game ended, not just *who* won.
- The user's requested sidebar behavior can be implemented as an idle-fading right rail plus a fixed edge hover trigger zone, which is much simpler and more reliable than geometric pointer detection.
- Replacing textual move history with replay mode is feasible using existing `state.history` by reconstructing intermediate game states client-side.
- A first AI mode fits best as a pure helper module consuming `placeMove`/`getLegalBoards`, keeping the core engine unchanged while allowing future heuristic upgrades.
- The original wider board/sidebar spacing made the shell feel more theatrical than playable; narrowing the grid and aligning the board toward the sidebar better matches actual gameplay ergonomics.
- Compressing the sidebar works best as a pure sizing pass: reduce the sidebar track width, internal padding, and shell gap together, while recalculating board width against the slimmer rail.
- The “narrow default rail + expanded full sidebar” model can be layered onto the existing shell without changing gameplay logic by splitting sidebar markup into compact and expanded sections and switching visibility entirely with CSS classes.
- When the shell mixes grid-based expectations with collapsed-width sidebars, the right rail can visually drift. Explicit right-edge anchoring is the safer model for this layout.
- The real root cause of the persistent sidebar bug was that the first anchoring attempt still relied on a content-growing shell. Browser inspection showed the sidebar rendering below the board. A stable two-column desktop grid fixed it decisively.
- HUD-style compact rails work better when text is minimized and the collapsed state reads like a narrow instrument strip rather than a miniature content panel.
- The current AI slowness was not search/heuristic cost; it was an intentionally inserted 520ms timeout in the UI turn runner. Lowering that delay is the correct first fix.
