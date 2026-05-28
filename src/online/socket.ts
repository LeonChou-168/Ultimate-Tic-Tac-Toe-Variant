import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './types';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createGameSocket(): GameSocket {
  return io(import.meta.env.VITE_SOCKET_SERVER_URL ?? 'http://localhost:3001', {
    autoConnect: false,
  });
}
