import type { BoardWinner, Cell, GameState, MoveResult, Player, Settlement } from './types';

const BOARD_COUNT = 9;
const CELL_COUNT = 9;
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function createInitialState(): GameState {
  return {
    boards: Array.from({ length: BOARD_COUNT }, () => Array<Cell>(CELL_COUNT).fill(null)),
    boardWinners: Array<BoardWinner>(BOARD_COUNT).fill(null),
    currentPlayer: 'black',
    targetBoard: null,
    lastMove: null,
    history: [],
    status: 'playing',
    settlement: null,
    drawOfferCounts: { black: 0, white: 0 },
    pendingDrawOffer: null,
  };
}

export function otherPlayer(player: Player): Player {
  return player === 'black' ? 'white' : 'black';
}

export function isValidIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < CELL_COUNT;
}

export function getBoardWinner(board: Cell[]): BoardWinner {
  for (const [a, b, c] of WIN_LINES) {
    const owner = board[a];
    if (owner && owner === board[b] && owner === board[c]) {
      return owner;
    }
  }

  return null;
}

export function isBoardFull(board: Cell[]): boolean {
  return board.every(Boolean);
}

export function canBoardStillBeWon(board: Cell[]): boolean {
  if (getBoardWinner(board)) {
    return false;
  }

  return WIN_LINES.some(([a, b, c]) => {
    const line = [board[a], board[b], board[c]];
    return !line.includes('black') || !line.includes('white');
  });
}

export function isBoardPlayable(state: GameState, boardIndex: number): boolean {
  const board = state.boards[boardIndex];
  return board !== undefined && !state.boardWinners[boardIndex] && !isBoardFull(board);
}

export function getLegalBoards(state: GameState): number[] {
  if (state.status !== 'playing') {
    return [];
  }

  if (state.targetBoard !== null && isBoardPlayable(state, state.targetBoard)) {
    return [state.targetBoard];
  }

  return state.boards.map((_, index) => index).filter((index) => isBoardPlayable(state, index));
}

export function isLegalMove(state: GameState, boardIndex: number, cellIndex: number): boolean {
  if (!isValidIndex(boardIndex) || !isValidIndex(cellIndex) || state.status !== 'playing') {
    return false;
  }

  const board = state.boards[boardIndex];
  if (!board || board[cellIndex] !== null) {
    return false;
  }

  return getLegalBoards(state).includes(boardIndex);
}

function explainIllegalMove(state: GameState, boardIndex: number, cellIndex: number): string {
  if (state.status !== 'playing') {
    return '对局已结束，请重新开始新的一局。';
  }

  if (!isValidIndex(boardIndex) || !isValidIndex(cellIndex)) {
    return '目标位置不存在。';
  }

  const board = state.boards[boardIndex];
  if (!board) {
    return '目标小棋盘不存在。';
  }

  if (state.boardWinners[boardIndex]) {
    return '该小棋盘已被占领，不能继续落子。';
  }

  if (isBoardFull(board)) {
    return '该小棋盘已经下满，不能继续落子。';
  }

  if (board[cellIndex] !== null) {
    return '该位置已有棋子，请选择其他空位。';
  }

  const legalBoards = getLegalBoards(state);
  if (!legalBoards.includes(boardIndex)) {
    if (state.targetBoard !== null && isBoardPlayable(state, state.targetBoard)) {
      return `当前必须在小棋盘 ${state.targetBoard} 内落子。`;
    }

    return '当前为自由落子阶段，但该小棋盘现在不可用。';
  }

  return '此位置当前不能落子。';
}

export function canManualSettle(state: GameState): boolean {
  if (state.status !== 'playing') {
    return false;
  }

  const playableBoards = state.boards
    .map((board, index) => ({ board, index }))
    .filter(({ index }) => !state.boardWinners[index]);

  return playableBoards.length > 0 && playableBoards.every(({ board }) => !canBoardStillBeWon(board));
}

export function shouldAutoSettle(state: GameState): boolean {
  return state.status === 'playing' && getLegalBoards(state).length === 0;
}

export function countOccupiedBoards(state: GameState): Pick<Settlement, 'blackBoards' | 'whiteBoards'> {
  return {
    blackBoards: state.boardWinners.filter((winner) => winner === 'black').length,
    whiteBoards: state.boardWinners.filter((winner) => winner === 'white').length,
  };
}

export function createSettlement(
  state: GameState,
  reason: Settlement['reason'],
  forcedWinner?: Player | 'draw',
): Settlement {
  const { blackBoards, whiteBoards } = countOccupiedBoards(state);
  let winner: Player | 'draw';

  if (forcedWinner) {
    winner = forcedWinner;
  } else if (blackBoards > whiteBoards) {
    winner = 'black';
  } else if (whiteBoards > blackBoards) {
    winner = 'white';
  } else {
    winner = 'draw';
  }

  return { reason, winner, blackBoards, whiteBoards };
}

export function placeMove(state: GameState, boardIndex: number, cellIndex: number): MoveResult {
  if (!isLegalMove(state, boardIndex, cellIndex)) {
    return {
      ok: false,
      state,
      message: explainIllegalMove(state, boardIndex, cellIndex),
    };
  }

  const boards = state.boards.map((board) => [...board]);
  const selectedBoard = boards[boardIndex];
  if (!selectedBoard) {
    return { ok: false, state, message: '小棋盘不存在。' };
  }

  selectedBoard[cellIndex] = state.currentPlayer;

  const boardWinners = [...state.boardWinners];
  boardWinners[boardIndex] = getBoardWinner(selectedBoard);

  const projectedBoard = boards[cellIndex];
  const targetBoard = boardWinners[cellIndex] || !projectedBoard || isBoardFull(projectedBoard) ? null : cellIndex;
  const move = { boardIndex, cellIndex, player: state.currentPlayer };
  const nextState: GameState = {
    ...state,
    boards,
    boardWinners,
    currentPlayer: otherPlayer(state.currentPlayer),
    targetBoard,
    lastMove: move,
    history: [...state.history, move],
    pendingDrawOffer: null,
  };

  if (shouldAutoSettle(nextState)) {
    return {
      ok: true,
      state: {
        ...nextState,
        status: 'settled',
        settlement: createSettlement(nextState, 'automatic'),
      },
      message: '所有可行棋区域已结束，自动结算。',
    };
  }

  return { ok: true, state: nextState, message: '落子成功。' };
}

export function settleGame(state: GameState): MoveResult {
  if (!canManualSettle(state) && !shouldAutoSettle(state)) {
    return { ok: false, state, message: '当前仍存在可争夺的小棋盘，不能主动结算。' };
  }

  return {
    ok: true,
    state: { ...state, status: 'settled', settlement: createSettlement(state, 'manual') },
    message: '已按占领小棋盘数量结算。',
  };
}

export function resignGame(state: GameState, player: Player): GameState {
  return {
    ...state,
    status: 'resigned',
    settlement: createSettlement(state, 'resignation', otherPlayer(player)),
    pendingDrawOffer: null,
  };
}

export function offerDraw(state: GameState, player: Player): MoveResult {
  if (state.status !== 'playing') {
    return { ok: false, state, message: '游戏已经结束，不能求和。' };
  }

  if (state.drawOfferCounts[player] >= 3) {
    return { ok: false, state, message: '本局求和次数已达上限。' };
  }

  return {
    ok: true,
    state: {
      ...state,
      drawOfferCounts: {
        ...state.drawOfferCounts,
        [player]: state.drawOfferCounts[player] + 1,
      },
      pendingDrawOffer: { offeredBy: player, moveNumber: state.history.length },
    },
    message: `${player === 'black' ? '黑方' : '白方'}发起求和。`,
  };
}

export function respondToDraw(state: GameState, accept: boolean): MoveResult {
  if (!state.pendingDrawOffer) {
    return { ok: false, state, message: '当前没有待响应的求和请求。' };
  }

  if (!accept) {
    return {
      ok: true,
      state: { ...state, pendingDrawOffer: null },
      message: '求和已拒绝，游戏继续。',
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      status: 'draw-agreed',
      settlement: createSettlement(state, 'draw-agreed', 'draw'),
      pendingDrawOffer: null,
    },
    message: '双方同意和棋。',
  };
}

export function formatPlayer(player: Player | 'draw'): string {
  if (player === 'black') {
    return '黑方';
  }
  if (player === 'white') {
    return '白方';
  }
  return '平局';
}
