import { describe, expect, it } from 'vitest';
import {
  canManualSettle,
  createInitialState,
  canBoardStillBeWon,
  getBoardWinner,
  getLegalBoards,
  offerDraw,
  placeMove,
  resignGame,
  respondToDraw,
} from './engine';
import type { Cell } from './types';

describe('Ultimate Tic-Tac-Toe Variant engine', () => {
  it('allows the first move anywhere and projects the next move to the played cell index', () => {
    const first = placeMove(createInitialState(), 3, 7);

    expect(first.ok).toBe(true);
    expect(first.state.targetBoard).toBe(7);
    expect(getLegalBoards(first.state)).toEqual([7]);
  });

  it('rejects moves outside the projected board', () => {
    const first = placeMove(createInitialState(), 3, 7);
    const illegal = placeMove(first.state, 6, 0);

    expect(illegal.ok).toBe(false);
    expect(illegal.state).toBe(first.state);
  });

  it('opens free play when the projected board is already occupied', () => {
    const state = createInitialState();
    state.boardWinners[4] = 'black';
    const result = placeMove(state, 0, 4);

    expect(result.ok).toBe(true);
    expect(result.state.targetBoard).toBeNull();
    expect(getLegalBoards(result.state)).not.toContain(4);
  });

  it('marks small boards as occupied after three in a row', () => {
    const board: Cell[] = ['black', 'black', 'black', null, null, null, null, null, null];

    expect(getBoardWinner(board)).toBe('black');
  });

  it('prevents moves in occupied boards', () => {
    const state = createInitialState();
    state.boardWinners[0] = 'white';
    const result = placeMove(state, 0, 8);

    expect(result.ok).toBe(false);
  });

  it('supports resignation with the opponent as winner', () => {
    const state = resignGame(createInitialState(), 'black');

    expect(state.status).toBe('resigned');
    expect(state.settlement?.winner).toBe('white');
  });

  it('limits each side to three draw offers', () => {
    let state = createInitialState();
    for (let i = 0; i < 3; i += 1) {
      const offer = offerDraw(state, 'black');
      expect(offer.ok).toBe(true);
      state = respondToDraw(offer.state, false).state;
    }

    expect(offerDraw(state, 'black').ok).toBe(false);
  });

  it('settles as draw when a draw offer is accepted', () => {
    const offered = offerDraw(createInitialState(), 'black');
    const accepted = respondToDraw(offered.state, true);

    expect(accepted.state.status).toBe('draw-agreed');
    expect(accepted.state.settlement?.winner).toBe('draw');
  });

  it('detects manual settlement only when every unoccupied board is full', () => {
    const state = createInitialState();
    state.boards = state.boards.map(() => Array<Cell>(9).fill('black'));
    state.boardWinners = Array(9).fill(null);

    expect(canManualSettle(state)).toBe(true);
  });

  it('detects boards that can no longer produce any three-in-a-row winner', () => {
    const deadBoard: Cell[] = ['black', 'white', 'black', 'black', 'white', 'white', 'white', 'black', null];

    expect(canBoardStillBeWon(deadBoard)).toBe(false);
  });

  it('allows manual settlement when all unoccupied boards are unwinnable draws', () => {
    const state = createInitialState();
    const deadBoard: Cell[] = ['black', 'white', 'black', 'black', 'white', 'white', 'white', 'black', null];
    state.boards = state.boards.map(() => [...deadBoard]);
    state.boardWinners = Array(9).fill(null);

    expect(canManualSettle(state)).toBe(true);
  });

  it('blocks manual settlement while any unoccupied board can still be won', () => {
    const state = createInitialState();
    const deadBoard: Cell[] = ['black', 'white', 'black', 'black', 'white', 'white', 'white', 'black', null];
    state.boards = state.boards.map(() => [...deadBoard]);
    state.boards[4] = ['black', 'black', null, null, null, null, null, null, null];
    state.boardWinners = Array(9).fill(null);

    expect(canManualSettle(state)).toBe(false);
  });
});
