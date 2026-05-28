import {
  createInitialState,
  offerDraw,
  placeMove,
  resignGame,
  respondToDraw,
  settleGame,
} from '../src/game/engine';
import type { GameState, Player } from '../src/game/types';
import type { GameErrorCode, RoomPlayer, RoomSnapshot, RoomState, RoomStatus } from './types';
import { generateReconnectToken } from './utils/ids';

interface SessionFailure {
  ok: false;
  code: GameErrorCode;
  message: string;
}

interface SessionJoinSuccess {
  ok: true;
  room: RoomState;
  player: RoomPlayer;
  message: string;
  restored: boolean;
}

interface SessionActionSuccess {
  ok: true;
  room: RoomState;
  message: string;
  ended: boolean;
}

export type SessionJoinResult = SessionJoinSuccess | SessionFailure;
export type SessionActionResult = SessionActionSuccess | SessionFailure;

function isSessionFailure(value: RoomPlayer | SessionFailure): value is SessionFailure {
  return 'code' in value;
}

function deriveRoomStatus(playerCount: number, gameState: GameState): RoomStatus {
  if (playerCount < 2) {
    return 'waiting';
  }

  return gameState.status === 'playing' ? 'playing' : 'finished';
}

function touchRoom(room: RoomState, timestamp: number): void {
  room.updatedAt = timestamp;
  room.status = deriveRoomStatus(room.players.length, room.gameState);
}

function buildPlayer(player: Player, socketId: string, timestamp: number): RoomPlayer {
  return {
    player,
    socketId,
    reconnectToken: generateReconnectToken(),
    connected: true,
    joinedAt: timestamp,
    lastSeenAt: timestamp,
  };
}

function getPlayerBySocket(room: RoomState, socketId: string): RoomPlayer | undefined {
  return room.players.find((player) => player.socketId === socketId);
}

function ensureRoomReady(room: RoomState): SessionFailure | null {
  if (room.players.length < 2) {
    return {
      ok: false,
      code: 'GAME_NOT_READY',
      message: '房间内还没有两位玩家，暂时不能开始对局。',
    };
  }

  if (room.gameState.status !== 'playing') {
    return {
      ok: false,
      code: 'GAME_ALREADY_FINISHED',
      message: '当前对局已经结束，请重新创建房间开始新的一局。',
    };
  }

  return null;
}

function ensureActor(room: RoomState, socketId: string): RoomPlayer | SessionFailure {
  const player = getPlayerBySocket(room, socketId);
  if (!player) {
    return {
      ok: false,
      code: 'PLAYER_NOT_IN_ROOM',
      message: '当前连接不在该房间中。',
    };
  }

  return player;
}

function finishAction(room: RoomState, message: string, timestamp: number): SessionActionSuccess {
  touchRoom(room, timestamp);
  room.expiresAt = null;
  return {
    ok: true,
    room,
    message,
    ended: room.gameState.status !== 'playing',
  };
}

export function createRoomState(roomId: string, hostSocketId: string, timestamp: number): RoomState {
  const host = buildPlayer('black', hostSocketId, timestamp);

  return {
    roomId,
    players: [host],
    gameState: createInitialState(),
    status: 'waiting',
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: null,
  };
}

export function joinAvailableSeat(room: RoomState, socketId: string, timestamp: number): SessionJoinResult {
  if (room.players.length >= 2) {
    return {
      ok: false,
      code: 'ROOM_FULL',
      message: '房间已经满员，不能再加入新玩家。',
    };
  }

  const player = buildPlayer('white', socketId, timestamp);
  room.players.push(player);
  touchRoom(room, timestamp);
  room.expiresAt = null;

  return {
    ok: true,
    room,
    player,
    restored: false,
    message: '加入房间成功，对局开始，黑方先行。',
  };
}

export function restoreDisconnectedPlayer(room: RoomState, reconnectToken: string, socketId: string, timestamp: number): SessionJoinResult {
  const player = room.players.find((candidate) => candidate.reconnectToken === reconnectToken);
  if (!player) {
    return {
      ok: false,
      code: 'INVALID_RECONNECT_TOKEN',
      message: '重连凭证无效，无法恢复到原来的座位。',
    };
  }

  if (player.connected) {
    return {
      ok: false,
      code: 'SEAT_ALREADY_TAKEN',
      message: '这个玩家席位已经在线，不能重复占用。',
    };
  }

  player.socketId = socketId;
  player.connected = true;
  player.lastSeenAt = timestamp;
  touchRoom(room, timestamp);
  room.expiresAt = null;

  return {
    ok: true,
    room,
    player,
    restored: true,
    message: '已恢复到原来的房间座位。',
  };
}

export function markPlayerDisconnected(room: RoomState, socketId: string, timestamp: number): RoomPlayer | undefined {
  const player = getPlayerBySocket(room, socketId);
  if (!player) {
    return undefined;
  }

  player.connected = false;
  player.socketId = null;
  player.lastSeenAt = timestamp;
  touchRoom(room, timestamp);
  return player;
}

export function applyMove(room: RoomState, socketId: string, boardIndex: number, cellIndex: number, timestamp: number): SessionActionResult {
  const roomReadyFailure = ensureRoomReady(room);
  if (roomReadyFailure) {
    return roomReadyFailure;
  }

  const actor = ensureActor(room, socketId);
  if (isSessionFailure(actor)) {
    return actor;
  }

  if (actor.player !== room.gameState.currentPlayer) {
    return {
      ok: false,
      code: 'NOT_YOUR_TURN',
      message: '当前不是你的回合。',
    };
  }

  const result = placeMove(room.gameState, boardIndex, cellIndex);
  if (!result.ok) {
    return {
      ok: false,
      code: 'ILLEGAL_MOVE',
      message: result.message,
    };
  }

  room.gameState = result.state;
  actor.lastSeenAt = timestamp;
  return finishAction(room, result.message, timestamp);
}

export function resignCurrentGame(room: RoomState, socketId: string, timestamp: number): SessionActionResult {
  const roomReadyFailure = ensureRoomReady(room);
  if (roomReadyFailure) {
    return roomReadyFailure;
  }

  const actor = ensureActor(room, socketId);
  if (isSessionFailure(actor)) {
    return actor;
  }

  room.gameState = resignGame(room.gameState, actor.player);
  actor.lastSeenAt = timestamp;
  return finishAction(room, `${actor.player === 'black' ? '黑方' : '白方'}已认输。`, timestamp);
}

export function offerRoomDraw(room: RoomState, socketId: string, timestamp: number): SessionActionResult {
  const roomReadyFailure = ensureRoomReady(room);
  if (roomReadyFailure) {
    return roomReadyFailure;
  }

  const actor = ensureActor(room, socketId);
  if (isSessionFailure(actor)) {
    return actor;
  }

  const result = offerDraw(room.gameState, actor.player);
  if (!result.ok) {
    return {
      ok: false,
      code: 'DRAW_NOT_ALLOWED',
      message: result.message,
    };
  }

  room.gameState = result.state;
  actor.lastSeenAt = timestamp;
  return finishAction(room, result.message, timestamp);
}

export function respondToRoomDraw(room: RoomState, socketId: string, accept: boolean, timestamp: number): SessionActionResult {
  const roomReadyFailure = ensureRoomReady(room);
  if (roomReadyFailure) {
    return roomReadyFailure;
  }

  const actor = ensureActor(room, socketId);
  if (isSessionFailure(actor)) {
    return actor;
  }

  if (room.gameState.pendingDrawOffer?.offeredBy === actor.player) {
    return {
      ok: false,
      code: 'DRAW_RESPONSE_NOT_ALLOWED',
      message: '发起求和的一方不能自己响应这次求和请求。',
    };
  }

  const result = respondToDraw(room.gameState, accept);
  if (!result.ok) {
    return {
      ok: false,
      code: 'DRAW_RESPONSE_NOT_ALLOWED',
      message: result.message,
    };
  }

  room.gameState = result.state;
  actor.lastSeenAt = timestamp;
  return finishAction(room, result.message, timestamp);
}

export function settleRoomGame(room: RoomState, socketId: string, timestamp: number): SessionActionResult {
  const roomReadyFailure = ensureRoomReady(room);
  if (roomReadyFailure) {
    return roomReadyFailure;
  }

  const actor = ensureActor(room, socketId);
  if (isSessionFailure(actor)) {
    return actor;
  }

  const result = settleGame(room.gameState);
  if (!result.ok) {
    return {
      ok: false,
      code: 'SETTLEMENT_NOT_ALLOWED',
      message: result.message,
    };
  }

  room.gameState = result.state;
  actor.lastSeenAt = timestamp;
  return finishAction(room, result.message, timestamp);
}

export function serializeRoom(room: RoomState): RoomSnapshot {
  return {
    roomId: room.roomId,
    status: room.status,
    players: room.players.map((player) => ({
      player: player.player,
      connected: player.connected,
    })),
    gameState: room.gameState,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}
