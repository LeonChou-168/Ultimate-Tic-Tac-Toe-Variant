export type Player = 'black' | 'white';

export type Cell = Player | null;

export type BoardWinner = Player | null;

export type GameMode = 'human-vs-human' | 'human-vs-ai' | 'online';

export type GameStatus = 'playing' | 'settled' | 'resigned' | 'draw-agreed';

export type SettlementReason = 'automatic' | 'manual' | 'resignation' | 'draw-agreed';

export interface Move {
  boardIndex: number;
  cellIndex: number;
  player: Player;
}

export interface Settlement {
  reason: SettlementReason;
  winner: Player | 'draw';
  blackBoards: number;
  whiteBoards: number;
}

export interface DrawOffer {
  offeredBy: Player;
  moveNumber: number;
}

export interface GameState {
  boards: Cell[][];
  boardWinners: BoardWinner[];
  currentPlayer: Player;
  targetBoard: number | null;
  lastMove: Move | null;
  history: Move[];
  status: GameStatus;
  settlement: Settlement | null;
  drawOfferCounts: Record<Player, number>;
  pendingDrawOffer: DrawOffer | null;
}

export interface MoveResult {
  ok: boolean;
  state: GameState;
  message: string;
}
