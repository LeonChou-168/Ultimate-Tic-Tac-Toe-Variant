# Findings

## Research Log

- Planning files were not present at session start; initialized fresh files.
- Background explore agents were attempted for engine mapping, rule comparison, and verification command discovery, but all failed immediately with `Missing Authentication header`; proceeded with direct repository tools.

## Specification Notes

- Spec source: `docs/specs/Ultimate Tic-Tac-Toe Variant 规格说明书.md`.
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
- The gold target-border bug came from coupling legal-board highlighting to `displayState`, which swaps to replay state during replay mode. Live guidance should stay tied to the live game state, while replay mode should not present active target guidance.
- A separate gold-border issue came from the tutorial focus ring being applied to `.board-stage fullscreen-board`, which spans the whole main board region. Applying it to the inner `.board-frame` scopes the border correctly.
- The user’s intended meaning is stricter: **gold** should belong only to playable small-board targeting, not to any board-level tutorial framing. Removing the board-level gold focus entirely matches that expectation best.
- The “ultra-fast AI” variant is just the same AI move chooser with zero artificial UI delay. No logic changes were required.
- The fade-mode “乱弹” bug was caused by `updateFeedback()` unconditionally calling `setSidebarVisible(true)`. Limiting sidebar reveal to deliberate/important events fixes the issue cleanly.
- The sidebar can be converted to a multi-level structure without a full architectural rewrite by gating the existing blocks behind a selected `sidebarSection` and adding a first-layer entry menu.
- A good next step after the 5-section IA refactor is to make the first layer read like a HUD index: compact badges plus short summaries work better than plain stacked buttons.
- The user prefers an even cleaner first layer: the badge + summary pattern is enough, so the explicit list heading and visible entry titles can be removed without breaking discoverability.
- The header-level “返回词条” action reads better as a small back-chip than as a full-weight action button because it is secondary navigation, not a primary operation.
- Removing internal numbering from the board UI works much better when replaced with a proper external coordinate system. Natural-language position names plus explicit coordinates give both readability and precision.
- The next refinement after adding coordinates is consistency: compact `A1–C3`-style ranges are cleaner than separate “列/行” phrasing, and a dedicated coordinate pill makes the textual target feel visibly linked to the highlighted board region.
- The generic sidebar grid was too overloaded. The three 对局状态 modules needed their own dedicated layout hook (`status-strip`) to guarantee a horizontal arrangement independent of other sidebar sections.
- In a narrow sidebar, “horizontal” also requires denser card sizing; otherwise the cards technically form columns but still feel like stacked blocks. Reducing padding and typography solves that practical issue.
- The user’s intended meaning of “横向模块” was semantic, not row-based: each module should be a horizontally styled information card, while the three cards themselves remain vertically stacked.
- Motion polish benefits from separating three phases: surface reveal, container reveal, then content reveal. A softer staggered left-to-right text entrance reads more deliberate and less abrupt than a single fade.
- For the landing/menu flow, the biggest improvement comes from stronger separation between headline, supporting text, and action group delays; otherwise the transition still feels like a single block appears at once.
- The remaining abruptness was caused by architecture, not timing: welcome and menu were separate early-return branches, so the outgoing screen unmounted immediately. A persistent landing-stage is required for a true handoff.
- Once the structural handoff is fixed, the next biggest quality gain comes from secondary motion layers: background breathing between landing states, a small button press beat before navigation, and a dedicated first-entry sidebar animation when entering the game.
- For product-page-like landing motion, per-character text reveal works best when paired with stronger page-level identity differences (for example, welcome and menu using different directional light fields) and a matched board/sidebar entry choreography when entering the game.
- Eye strain on these landing screens came less from animation count and more from proportion/energy balance: oversized centered cards, overly similar character timing across roles, and transition blur/saturation peaks that were slightly too hot.
- The “board pops twice” bug was caused by two entrance animations hitting the same element: `.board-frame-large` still had a baseline `panelReveal` while game entry also applied `boardSettleIn`.
- The welcome CTAs needed their own sizing rule instead of inheriting the general button rhythm, and typography diversity works best as a small role-based system (display/body/UI) rather than ad hoc font changes per element.
- The repository was already close to a standard app layout; the real cleanup value came from reducing top-level clutter by moving product/spec docs under `docs/specs/` and debug imagery under `docs/images/` while leaving generated/workflow files intact.
- The next highest-value GitHub-standard additions for this repo were lightweight community/meta files and docs discoverability, not deeper structural churn. A LICENSE file should not be invented without the maintainer’s explicit choice.
- The provided React Bits SplitText sample can be integrated cleanly here as a local wrapper component, but in this TypeScript setup it needs adapter work: broader internal GSAP types, dynamic tag creation, and a repo-local class hook so the animation component inherits the existing headline styling.
- To make SplitText feel premium on screen transitions, the important distinction is not just slower props: the component must also allow intentional replay and the landing screens must provide fresh keyed instances when those headings re-enter.
- The yellow seam between adjacent small boards was not a divider-color bug; it was the external glow in `.small-board.legal` bleeding into the dark inter-board seam. Removing the outer glow while keeping the inset ring preserves intent and fixes the artifact.
- A more reliable fix than tuning the board-level shadow is to render legal highlighting on an inset pseudo-element. That structurally prevents any gold effect from touching shared seams between neighboring small boards.
- Even after moving the legal highlight to a pseudo-element, an inset equal to the divider thickness can still visually kiss the macro-board edge on bottom-row boards. Pulling the inset farther inward is safer for eliminating bottom-edge yellow artifacts.
- If specific interior coordinates still appear yellow, the remaining problem is no longer seam placement but glow diffusion. The robust fix is to remove all soft legal-board glow and keep only a crisp perimeter line.
- If even a crisp inset perimeter still reads inside coordinates, the most robust rendering strategy is not a border at all but four explicit edge strips. That paints only the outer edges of the legal small board and cannot draw an accidental line through the board interior.
- If the user wants all yellow line artifacts gone, the cleanest fallback is to abandon line-based legal highlighting completely and switch to a low-contrast board-wide tonal cue.
- The landing page adapted better because it used `min(100%, …)`-style width bounds everywhere, while the game shell still relied on a fixed sidebar width/height and a board width formula tied directly to viewport width. Making the shell fluid at the grid-track level is more effective than patching individual child widths.
