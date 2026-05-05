import { getLegalBoards, placeMove } from './engine';
import type { GameState, Player } from './types';

export interface AIMove {
  boardIndex: number;
  cellIndex: number;
}

const CORNER_CELLS = new Set([0, 2, 6, 8]);

function hasImmediateOpponentClaim(nextState: GameState, aiPlayer: Player): boolean {
  const opponent = aiPlayer === 'black' ? 'white' : 'black';
  if (nextState.status !== 'playing' || nextState.currentPlayer !== opponent) {
    return false;
  }

  const claimCount = nextState.boardWinners.filter((winner) => winner === opponent).length;
  const legalBoards = getLegalBoards(nextState);

  return legalBoards.some((boardIndex) =>
    nextState.boards[boardIndex]?.some((cell, cellIndex) => {
      if (cell !== null) {
        return false;
      }

      const result = placeMove(nextState, boardIndex, cellIndex);
      if (!result.ok) {
        return false;
      }

      const nextClaimCount = result.state.boardWinners.filter((winner) => winner === opponent).length;
      return nextClaimCount > claimCount;
    }),
  );
}

export function chooseAIMove(state: GameState, aiPlayer: Player): AIMove | null {
  if (state.status !== 'playing' || state.currentPlayer !== aiPlayer) {
    return null;
  }

  const legalBoards = getLegalBoards(state);
  const currentClaimCount = state.boardWinners.filter((winner) => winner === aiPlayer).length;

  let bestMove: AIMove | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const boardIndex of legalBoards) {
    const board = state.boards[boardIndex];
    if (!board) {
      continue;
    }

    for (let cellIndex = 0; cellIndex < board.length; cellIndex += 1) {
      if (board[cellIndex] !== null) {
        continue;
      }

      const result = placeMove(state, boardIndex, cellIndex);
      if (!result.ok) {
        continue;
      }

      let score = 0;
      const nextClaimCount = result.state.boardWinners.filter((winner) => winner === aiPlayer).length;

      if (result.state.settlement?.winner === aiPlayer) {
        score += 1200;
      }

      if (nextClaimCount > currentClaimCount) {
        score += 280;
      }

      if (boardIndex === 4) {
        score += 22;
      }

      if (cellIndex === 4) {
        score += 18;
      } else if (CORNER_CELLS.has(cellIndex)) {
        score += 11;
      } else {
        score += 6;
      }

      if (result.state.targetBoard === null) {
        score -= 8;
      }

      if (hasImmediateOpponentClaim(result.state, aiPlayer)) {
        score -= 95;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = { boardIndex, cellIndex };
      }
    }
  }

  return bestMove;
}
