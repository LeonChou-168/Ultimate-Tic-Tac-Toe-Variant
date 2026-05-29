import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/engine';
import type { GameState, Player } from '../game/types';
import { useOnlineMatch, type OnlineFeedback } from './useOnlineMatch';
import type { ClientToServerEvents, RoomSnapshot, ServerToClientEvents } from './types';

type ServerEventName = keyof ServerToClientEvents | 'connect' | 'disconnect';

type EventHandlerMap = {
  [K in ServerEventName]?: Array<(...args: unknown[]) => void>;
};

class FakeSocket {
  public connected = false;
  public handlers: EventHandlerMap = {};
  public emitted: Array<{ event: keyof ClientToServerEvents; payload: unknown }> = [];

  public connect() {
    this.connected = true;
    this.handlers.connect?.forEach((handler) => handler());
    return this;
  }

  public disconnect() {
    this.connected = false;
    this.handlers.disconnect?.forEach((handler) => handler());
    return this;
  }

  public on(event: ServerEventName, handler: (...args: unknown[]) => void) {
    const current = this.handlers[event] ?? [];
    current.push(handler);
    this.handlers[event] = current;
    return this;
  }

  public off(event: ServerEventName, handler: (...args: unknown[]) => void) {
    this.handlers[event] = (this.handlers[event] ?? []).filter((candidate) => candidate !== handler);
    return this;
  }

  public emit<K extends keyof ClientToServerEvents>(event: K, payload?: Parameters<ClientToServerEvents[K]>[0]) {
    this.emitted.push({ event, payload });
    return this;
  }

  public serverEmit<K extends keyof ServerToClientEvents>(event: K, payload: Parameters<ServerToClientEvents[K]>[0]) {
    for (const handler of this.handlers[event] ?? []) {
      handler(payload);
    }
  }
}

function makeRoom(roomId: string, players: Array<{ player: Player; connected: boolean }>, gameState: GameState = createInitialState()): RoomSnapshot {
  return {
    roomId,
    status: players.length === 2 ? 'playing' : 'waiting',
    players,
    gameState,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createHarness(socket: FakeSocket) {
  const container = document.createElement('div');
  const root = createRoot(container);
  let latestResult: ReturnType<typeof useOnlineMatch> | null = null;
  const feedbacks: OnlineFeedback[] = [];
  const openReasons: Array<'created' | 'joined'> = [];

  function Harness() {
    latestResult = useOnlineMatch({
      onFeedback: (feedback) => {
        feedbacks.push(feedback);
      },
      onGameState: () => {},
      onOpenGameScreen: (reason) => {
        openReasons.push(reason);
      },
      onClaimCelebration: () => {},
      onInvalidAction: () => {},
      socketFactory: () => socket as never,
    });
    return null;
  }

  act(() => {
    root.render(<Harness />);
  });

  return {
    get result() {
      if (!latestResult) {
        throw new Error('hook result not ready');
      }
      return latestResult;
    },
    feedbacks,
    openReasons,
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

let mountedRoots: Array<{ unmount: () => void }> = [];

afterEach(() => {
  for (const harness of mountedRoots.splice(0)) {
    harness.unmount();
  }
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useOnlineMatch', () => {
  it('keeps the host role as black after room:update opens the match', () => {
    const socket = new FakeSocket();
    const harness = createHarness(socket);
    mountedRoots.push(harness);

    act(() => {
      harness.result.createRoom();
    });

    expect(socket.emitted).toContainEqual({ event: 'room:create', payload: undefined });

    act(() => {
      socket.serverEmit('room:created', {
        room: makeRoom('ROOM01', [{ player: 'black', connected: true }]),
        player: 'black',
        reconnectToken: 'token-black',
        message: '房间已创建，等待另一位玩家加入。',
      });
    });

    expect(harness.result.player).toBe('black');
    expect(harness.result.playerLabel).toBe('黑方');
    expect(harness.openReasons).toContain('created');

    act(() => {
      socket.serverEmit('room:update', {
        room: makeRoom('ROOM01', [
          { player: 'black', connected: true },
          { player: 'white', connected: true },
        ]),
        message: '房间人数已更新。',
      });
    });

    expect(harness.result.player).toBe('black');
    expect(harness.result.playerLabel).toBe('黑方');
    expect(harness.result.waitingForOpponent).toBe(false);
    expect(harness.result.opponentConnected).toBe(true);
    expect(harness.openReasons).toContain('joined');
  });

  it('assigns the joining player to white and blocks moves before their turn', () => {
    const socket = new FakeSocket();
    const harness = createHarness(socket);
    mountedRoots.push(harness);

    act(() => {
      harness.result.joinRoom('ROOM02');
    });

    expect(socket.emitted).toContainEqual({
      event: 'room:join',
      payload: { roomId: 'ROOM02', reconnectToken: undefined },
    });

    act(() => {
      socket.serverEmit('room:joined', {
        room: makeRoom('ROOM02', [
          { player: 'black', connected: true },
          { player: 'white', connected: true },
        ]),
        player: 'white',
        reconnectToken: 'token-white',
        message: '加入房间成功，对局开始，黑方先行。',
      });
    });

    expect(harness.result.player).toBe('white');
    expect(harness.result.playerLabel).toBe('白方');
    expect(harness.result.isPlayerTurn).toBe(false);

    act(() => {
      harness.result.sendMove(0, 0);
    });

    expect(harness.feedbacks.at(-1)).toEqual({
      message: '联机模式下当前不是你的回合。',
      ok: false,
      revealSidebar: true,
    });
  });
});
