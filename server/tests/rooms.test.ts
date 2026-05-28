import { describe, expect, it } from 'vitest';
import type { ServerConfig } from '../config';
import { RoomStore } from '../rooms';

const testConfig: ServerConfig = {
  port: 3001,
  clientOrigin: 'http://localhost:5173',
  roomTtlMs: 5_000,
  disconnectGraceMs: 2_000,
};

describe('RoomStore', () => {
  it('creates a room and lets a second player join it', () => {
    const store = new RoomStore(testConfig, () => 'ROOM01', () => 1_000);
    const created = store.createRoom('socket-a');

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    expect(created.room.roomId).toBe('ROOM01');
    expect(created.player?.player).toBe('black');

    const joined = store.joinRoom('room01', 'socket-b');
    expect(joined.ok).toBe(true);
    if (!joined.ok) {
      return;
    }

    expect(joined.player?.player).toBe('white');
    expect(joined.room.status).toBe('playing');
  });

  it('restores a disconnected player with its reconnect token', () => {
    let now = 1_000;
    const store = new RoomStore(testConfig, () => 'ROOM02', () => now);
    const created = store.createRoom('socket-a');
    if (!created.ok || !created.player) {
      throw new Error('room creation failed in test setup');
    }

    now = 1_100;
    const disconnected = store.markDisconnected('socket-a');
    expect(disconnected?.ok).toBe(true);

    now = 1_200;
    const restored = store.joinRoom('ROOM02', 'socket-c', created.player.reconnectToken);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }

    expect(restored.restored).toBe(true);
    expect(restored.player?.player).toBe('black');
    expect(restored.room.players[0]?.connected).toBe(true);
  });
});
