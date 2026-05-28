import type { ServerConfig } from './config';
import {
  applyMove,
  createRoomState,
  joinAvailableSeat,
  markPlayerDisconnected,
  offerRoomDraw,
  resignCurrentGame,
  respondToRoomDraw,
  restoreDisconnectedPlayer,
  settleRoomGame,
} from './game-session';
import type { GameErrorCode, RoomPlayer, RoomState } from './types';
import { generateRoomId } from './utils/ids';
import { now as getNow } from './utils/time';

interface FailureResult {
  ok: false;
  code: GameErrorCode;
  message: string;
}

interface SuccessResult<T = undefined> {
  ok: true;
  room: RoomState;
  message: string;
  player?: RoomPlayer;
  restored?: boolean;
  ended?: boolean;
  value?: T;
}

export type RoomMutationResult<T = undefined> = SuccessResult<T> | FailureResult;

function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase();
}

export class RoomStore {
  private readonly rooms = new Map<string, RoomState>();

  public constructor(
    private readonly config: ServerConfig,
    private readonly roomIdFactory: () => string = generateRoomId,
    private readonly clock: () => number = getNow,
  ) {}

  public createRoom(socketId: string): RoomMutationResult {
    this.cleanupExpiredRooms();

    if (this.findRoomBySocket(socketId)) {
      return {
        ok: false,
        code: 'ALREADY_IN_ROOM',
        message: '当前连接已经在一个房间内，请先离开或断开原来的房间。',
      };
    }

    let roomId = this.roomIdFactory();
    while (this.rooms.has(roomId)) {
      roomId = this.roomIdFactory();
    }

    const room = createRoomState(roomId, socketId, this.clock());
    this.rooms.set(roomId, room);

    return {
      ok: true,
      room,
      player: room.players[0],
      message: '房间已创建，等待另一位玩家加入。',
    };
  }

  public joinRoom(roomId: string, socketId: string, reconnectToken?: string): RoomMutationResult {
    this.cleanupExpiredRooms();

    if (this.findRoomBySocket(socketId)) {
      return {
        ok: false,
        code: 'ALREADY_IN_ROOM',
        message: '当前连接已经在一个房间内，请不要重复加入。',
      };
    }

    const room = this.rooms.get(normalizeRoomId(roomId));
    if (!room) {
      return {
        ok: false,
        code: 'ROOM_NOT_FOUND',
        message: '房间不存在，请检查房间号是否正确。',
      };
    }

    const timestamp = this.clock();
    const result = reconnectToken
      ? restoreDisconnectedPlayer(room, reconnectToken, socketId, timestamp)
      : joinAvailableSeat(room, socketId, timestamp);

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      room,
      player: result.player,
      restored: result.restored,
      message: result.message,
    };
  }

  public getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(normalizeRoomId(roomId));
  }

  public applyMove(roomId: string, socketId: string, boardIndex: number, cellIndex: number): RoomMutationResult {
    return this.runRoomAction(roomId, (room, timestamp) => applyMove(room, socketId, boardIndex, cellIndex, timestamp));
  }

  public resign(roomId: string, socketId: string): RoomMutationResult {
    return this.runRoomAction(roomId, (room, timestamp) => resignCurrentGame(room, socketId, timestamp));
  }

  public offerDraw(roomId: string, socketId: string): RoomMutationResult {
    return this.runRoomAction(roomId, (room, timestamp) => offerRoomDraw(room, socketId, timestamp));
  }

  public respondToDraw(roomId: string, socketId: string, accept: boolean): RoomMutationResult {
    return this.runRoomAction(roomId, (room, timestamp) => respondToRoomDraw(room, socketId, accept, timestamp));
  }

  public settle(roomId: string, socketId: string): RoomMutationResult {
    return this.runRoomAction(roomId, (room, timestamp) => settleRoomGame(room, socketId, timestamp));
  }

  public markDisconnected(socketId: string): RoomMutationResult<{ player: RoomPlayer }> | null {
    const room = this.findRoomBySocket(socketId);
    if (!room) {
      return null;
    }

    const timestamp = this.clock();
    const player = markPlayerDisconnected(room, socketId, timestamp);
    if (!player) {
      return null;
    }

    room.expiresAt = timestamp + this.config.disconnectGraceMs;

    return {
      ok: true,
      room,
      player,
      value: { player },
      message: `${player.player === 'black' ? '黑方' : '白方'}已断开连接，房间暂时保留等待重连。`,
    };
  }

  public cleanupExpiredRooms(): string[] {
    const timestamp = this.clock();
    const removedRoomIds: string[] = [];

    for (const [roomId, room] of this.rooms) {
      const noConnectedPlayers = room.players.every((player) => !player.connected);
      const waitingExpired = room.players.length < 2 && timestamp - room.updatedAt >= this.config.roomTtlMs;
      const reconnectExpired = room.expiresAt !== null && timestamp >= room.expiresAt;

      if (noConnectedPlayers && (waitingExpired || reconnectExpired)) {
        this.rooms.delete(roomId);
        removedRoomIds.push(roomId);
      }
    }

    return removedRoomIds;
  }

  private runRoomAction(
    roomId: string,
    action: (room: RoomState, timestamp: number) => ReturnType<typeof applyMove>,
  ): RoomMutationResult {
    const room = this.getRoom(roomId);
    if (!room) {
      return {
        ok: false,
        code: 'ROOM_NOT_FOUND',
        message: '房间不存在或已过期。',
      };
    }

    const result = action(room, this.clock());
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      room: result.room,
      message: result.message,
      ended: result.ended,
    };
  }

  private findRoomBySocket(socketId: string): RoomState | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((player) => player.socketId === socketId)) {
        return room;
      }
    }

    return undefined;
  }
}
