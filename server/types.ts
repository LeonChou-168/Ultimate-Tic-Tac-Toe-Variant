import type { GameState, Player } from '../src/game/types';

export interface RoomPlayer {
  player: Player;
  socketId: string | null;
  reconnectToken: string;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface RoomState {
  roomId: string;
  players: RoomPlayer[];
  gameState: GameState;
  status: RoomStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
}

export interface RoomPlayerSnapshot {
  player: Player;
  connected: boolean;
}

export interface RoomSnapshot {
  roomId: string;
  status: RoomStatus;
  players: RoomPlayerSnapshot[];
  gameState: GameState;
  createdAt: number;
  updatedAt: number;
}

export type GameErrorCode =
  | 'ALREADY_IN_ROOM'
  | 'DRAW_NOT_ALLOWED'
  | 'DRAW_RESPONSE_NOT_ALLOWED'
  | 'GAME_ALREADY_FINISHED'
  | 'GAME_NOT_READY'
  | 'ILLEGAL_MOVE'
  | 'INVALID_RECONNECT_TOKEN'
  | 'NOT_YOUR_TURN'
  | 'PLAYER_NOT_IN_ROOM'
  | 'ROOM_FULL'
  | 'ROOM_NOT_FOUND'
  | 'SEAT_ALREADY_TAKEN'
  | 'SETTLEMENT_NOT_ALLOWED';

export type GameEndReason = 'settled' | 'resigned' | 'draw-agreed';

export interface RoomCreatedPayload {
  room: RoomSnapshot;
  player: Player;
  reconnectToken: string;
  message: string;
}

export interface RoomJoinedPayload extends RoomCreatedPayload {}

export interface RoomUpdatePayload {
  room: RoomSnapshot;
  message: string;
}

export interface GameUpdatePayload {
  roomId: string;
  state: GameState;
  message: string;
}

export interface GameErrorPayload {
  roomId?: string;
  code: GameErrorCode;
  message: string;
}

export interface GameEndedPayload extends GameUpdatePayload {
  reason: GameEndReason;
}

export interface ClientToServerEvents {
  'room:create': () => void;
  'room:join': (payload: { roomId: string; reconnectToken?: string }) => void;
  'game:move': (payload: { roomId: string; boardIndex: number; cellIndex: number }) => void;
  'game:resign': (payload: { roomId: string }) => void;
  'game:offer-draw': (payload: { roomId: string }) => void;
  'game:respond-draw': (payload: { roomId: string; accept: boolean }) => void;
  'game:settle': (payload: { roomId: string }) => void;
}

export interface ServerToClientEvents {
  'room:created': (payload: RoomCreatedPayload) => void;
  'room:joined': (payload: RoomJoinedPayload) => void;
  'room:update': (payload: RoomUpdatePayload) => void;
  'game:update': (payload: GameUpdatePayload) => void;
  'game:error': (payload: GameErrorPayload) => void;
  'game:ended': (payload: GameEndedPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {}
