import type { Server, Socket } from 'socket.io';
import { serializeRoom } from './game-session';
import type { ServerConfig } from './config';
import { RoomStore } from './rooms';
import type {
  ClientToServerEvents,
  GameEndReason,
  GameErrorPayload,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './types';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function emitError(socket: GameSocket, error: GameErrorPayload): void {
  socket.emit('game:error', error);
}

function resolveEndReason(status: string): GameEndReason {
  switch (status) {
    case 'resigned':
      return 'resigned';
    case 'draw-agreed':
      return 'draw-agreed';
    default:
      return 'settled';
  }
}

export function registerSocketHandlers(io: GameServer, config: ServerConfig): RoomStore {
  const roomStore = new RoomStore(config);

  io.on('connection', (socket) => {
    roomStore.cleanupExpiredRooms();

    socket.on('room:create', () => {
      const result = roomStore.createRoom(socket.id);
      if (!result.ok) {
        emitError(socket, { code: result.code, message: result.message });
        return;
      }
      if (!result.player) {
        emitError(socket, { code: 'PLAYER_NOT_IN_ROOM', message: '创建房间后未能分配玩家席位。' });
        return;
      }

      socket.join(result.room.roomId);
      socket.emit('room:created', {
        room: serializeRoom(result.room),
        player: result.player.player,
        reconnectToken: result.player.reconnectToken,
        message: result.message,
      });
    });

    socket.on('room:join', ({ roomId, reconnectToken }) => {
      const result = roomStore.joinRoom(roomId, socket.id, reconnectToken);
      if (!result.ok) {
        emitError(socket, { roomId, code: result.code, message: result.message });
        return;
      }
      if (!result.player) {
        emitError(socket, { roomId, code: 'PLAYER_NOT_IN_ROOM', message: '加入房间后未能分配玩家席位。' });
        return;
      }

      socket.join(result.room.roomId);
      socket.emit('room:joined', {
        room: serializeRoom(result.room),
        player: result.player.player,
        reconnectToken: result.player.reconnectToken,
        message: result.message,
      });

      io.to(result.room.roomId).emit('room:update', {
        room: serializeRoom(result.room),
        message: result.restored ? result.message : '房间人数已更新。',
      });

      if (!result.restored && result.room.players.length === 2) {
        io.to(result.room.roomId).emit('game:update', {
          roomId: result.room.roomId,
          state: result.room.gameState,
          message: '对局开始，黑方先行。',
        });
      }
    });

    socket.on('game:move', ({ roomId, boardIndex, cellIndex }) => {
      const result = roomStore.applyMove(roomId, socket.id, boardIndex, cellIndex);
      if (!result.ok) {
        emitError(socket, { roomId, code: result.code, message: result.message });
        return;
      }

      io.to(result.room.roomId).emit('game:update', {
        roomId: result.room.roomId,
        state: result.room.gameState,
        message: result.message,
      });

      if (result.ended) {
        io.to(result.room.roomId).emit('game:ended', {
          roomId: result.room.roomId,
          state: result.room.gameState,
          message: result.message,
          reason: resolveEndReason(result.room.gameState.status),
        });
      }
    });

    socket.on('game:resign', ({ roomId }) => {
      const result = roomStore.resign(roomId, socket.id);
      if (!result.ok) {
        emitError(socket, { roomId, code: result.code, message: result.message });
        return;
      }

      io.to(result.room.roomId).emit('game:update', {
        roomId: result.room.roomId,
        state: result.room.gameState,
        message: result.message,
      });

      io.to(result.room.roomId).emit('game:ended', {
        roomId: result.room.roomId,
        state: result.room.gameState,
        message: result.message,
        reason: 'resigned',
      });
    });

    socket.on('game:offer-draw', ({ roomId }) => {
      const result = roomStore.offerDraw(roomId, socket.id);
      if (!result.ok) {
        emitError(socket, { roomId, code: result.code, message: result.message });
        return;
      }

      io.to(result.room.roomId).emit('game:update', {
        roomId: result.room.roomId,
        state: result.room.gameState,
        message: result.message,
      });
    });

    socket.on('game:respond-draw', ({ roomId, accept }) => {
      const result = roomStore.respondToDraw(roomId, socket.id, accept);
      if (!result.ok) {
        emitError(socket, { roomId, code: result.code, message: result.message });
        return;
      }

      io.to(result.room.roomId).emit('game:update', {
        roomId: result.room.roomId,
        state: result.room.gameState,
        message: result.message,
      });

      if (result.ended) {
        io.to(result.room.roomId).emit('game:ended', {
          roomId: result.room.roomId,
          state: result.room.gameState,
          message: result.message,
          reason: 'draw-agreed',
        });
      }
    });

    socket.on('game:settle', ({ roomId }) => {
      const result = roomStore.settle(roomId, socket.id);
      if (!result.ok) {
        emitError(socket, { roomId, code: result.code, message: result.message });
        return;
      }

      io.to(result.room.roomId).emit('game:update', {
        roomId: result.room.roomId,
        state: result.room.gameState,
        message: result.message,
      });

      if (result.ended) {
        io.to(result.room.roomId).emit('game:ended', {
          roomId: result.room.roomId,
          state: result.room.gameState,
          message: result.message,
          reason: 'settled',
        });
      }
    });

    socket.on('disconnect', () => {
      const result = roomStore.markDisconnected(socket.id);
      if (!result?.ok) {
        return;
      }

      io.to(result.room.roomId).emit('room:update', {
        room: serializeRoom(result.room),
        message: result.message,
      });
    });
  });

  return roomStore;
}
