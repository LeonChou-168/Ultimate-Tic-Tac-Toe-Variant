import express from 'express';
import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { registerSocketHandlers } from '../socket-events';
import type { ServerConfig } from '../config';
import type {
  ClientToServerEvents,
  InterServerEvents,
  RoomCreatedPayload,
  RoomJoinedPayload,
  ServerToClientEvents,
  SocketData,
} from '../types';

type TestServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const baseConfig: ServerConfig = {
  port: 0,
  clientOrigin: true,
  roomTtlMs: 5_000,
  disconnectGraceMs: 2_000,
};

const openClients: TestClient[] = [];
const openServers: Array<{ io: TestServer; httpServer: ReturnType<typeof createServer> }> = [];

async function createTestEnvironment() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  registerSocketHandlers(io, baseConfig);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });

  openServers.push({ io, httpServer });
  const { port } = httpServer.address() as AddressInfo;
  return { port };
}

async function createTestClient(port: number): Promise<TestClient> {
  const client = createClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  await new Promise<void>((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('connect_error', reject);
  });

  openClients.push(client);
  return client;
}

function waitForEvent<T>(client: TestClient, event: keyof ServerToClientEvents): Promise<T> {
  return new Promise<T>((resolve) => {
    client.once(event, (payload: T) => resolve(payload));
  });
}

afterEach(async () => {
  for (const client of openClients.splice(0)) {
    client.close();
  }

  for (const server of openServers.splice(0)) {
    await new Promise<void>((resolve) => {
      server.io.close(() => {
        server.httpServer.close(() => resolve());
      });
    });
  }
});

describe('socket online flow', () => {
  it('assigns black to the host and white to the joining player, then broadcasts game start', async () => {
    const { port } = await createTestEnvironment();
    const host = await createTestClient(port);
    const guest = await createTestClient(port);

    const hostCreatedPromise = waitForEvent<RoomCreatedPayload>(host, 'room:created');
    host.emit('room:create');
    const hostCreated = await hostCreatedPromise;

    expect(hostCreated.player).toBe('black');
    expect(hostCreated.room.players).toEqual([{ player: 'black', connected: true }]);

    const hostRoomUpdatePromise = waitForEvent<{ room: RoomCreatedPayload['room']; message: string }>(host, 'room:update');
    const hostGameUpdatePromise = waitForEvent<{ roomId: string; state: RoomCreatedPayload['room']['gameState']; message: string }>(host, 'game:update');
    const guestJoinedPromise = waitForEvent<RoomJoinedPayload>(guest, 'room:joined');

    guest.emit('room:join', { roomId: hostCreated.room.roomId });

    const guestJoined = await guestJoinedPromise;
    expect(guestJoined.player).toBe('white');
    expect(guestJoined.room.players).toEqual([
      { player: 'black', connected: true },
      { player: 'white', connected: true },
    ]);

    const hostRoomUpdate = await hostRoomUpdatePromise;
    expect(hostRoomUpdate.room.players).toEqual([
      { player: 'black', connected: true },
      { player: 'white', connected: true },
    ]);

    const hostGameUpdate = await hostGameUpdatePromise;
    expect(hostGameUpdate.state.currentPlayer).toBe('black');
    expect(hostGameUpdate.state.history).toHaveLength(0);
    expect(hostGameUpdate.message).toContain('黑方先行');
  });

  it('allows a fresh socket to create a new room after the previous host disconnects', async () => {
    const { port } = await createTestEnvironment();
    const firstHost = await createTestClient(port);

    const firstCreatedPromise = waitForEvent<RoomCreatedPayload>(firstHost, 'room:created');
    firstHost.emit('room:create');
    const firstCreated = await firstCreatedPromise;

    expect(firstCreated.player).toBe('black');
    firstHost.close();

    const secondHost = await createTestClient(port);
    const secondCreatedPromise = waitForEvent<RoomCreatedPayload>(secondHost, 'room:created');
    secondHost.emit('room:create');
    const secondCreated = await secondCreatedPromise;

    expect(secondCreated.player).toBe('black');
    expect(secondCreated.room.roomId).not.toBe('');
  });

  it('broadcasts the first legal move to both players after a room starts', async () => {
    const { port } = await createTestEnvironment();
    const host = await createTestClient(port);
    const guest = await createTestClient(port);

    const hostCreatedPromise = waitForEvent<RoomCreatedPayload>(host, 'room:created');
    host.emit('room:create');
    const hostCreated = await hostCreatedPromise;

    const guestJoinedPromise = waitForEvent<RoomJoinedPayload>(guest, 'room:joined');
    const hostGameStartedPromise = waitForEvent<{ roomId: string; state: RoomCreatedPayload['room']['gameState']; message: string }>(host, 'game:update');
    const guestGameStartedPromise = waitForEvent<{ roomId: string; state: RoomCreatedPayload['room']['gameState']; message: string }>(guest, 'game:update');

    guest.emit('room:join', { roomId: hostCreated.room.roomId });
    await guestJoinedPromise;
    await hostGameStartedPromise;
    await guestGameStartedPromise;

    const hostMoveUpdatePromise = waitForEvent<{ roomId: string; state: RoomCreatedPayload['room']['gameState']; message: string }>(host, 'game:update');
    const guestMoveUpdatePromise = waitForEvent<{ roomId: string; state: RoomCreatedPayload['room']['gameState']; message: string }>(guest, 'game:update');

    host.emit('game:move', { roomId: hostCreated.room.roomId, boardIndex: 0, cellIndex: 4 });

    const hostMoveUpdate = await hostMoveUpdatePromise;
    const guestMoveUpdate = await guestMoveUpdatePromise;

    expect(hostMoveUpdate.state.history).toHaveLength(1);
    expect(hostMoveUpdate.state.history[0]).toEqual({
      boardIndex: 0,
      cellIndex: 4,
      player: 'black',
    });
    expect(hostMoveUpdate.state.currentPlayer).toBe('white');
    expect(hostMoveUpdate.state.targetBoard).toBe(4);

    expect(guestMoveUpdate.state.history).toEqual(hostMoveUpdate.state.history);
    expect(guestMoveUpdate.state.currentPlayer).toBe('white');
    expect(guestMoveUpdate.message).toContain('落子成功');
  });
});
