import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, Player } from '../game/types';
import { createInitialState } from '../game/engine';
import { createGameSocket } from './socket';
import type {
  GameEndedPayload,
  GameErrorPayload,
  GameUpdatePayload,
  RoomSnapshot,
  RoomUpdatePayload,
} from './types';

export type OnlineConnectionState = 'offline' | 'connecting' | 'connected';

export interface OnlineFeedback {
  message: string;
  ok: boolean;
  revealSidebar?: boolean;
}

interface UseOnlineMatchOptions {
  onFeedback: (feedback: OnlineFeedback) => void;
  onGameState: (state: GameState) => void;
  onOpenGameScreen: (reason: 'created' | 'joined') => void;
  onClaimCelebration: (previousWinners: Array<Player | null>, nextWinners: Array<Player | null>) => void;
  onInvalidAction?: () => void;
  socketFactory?: typeof createGameSocket;
}

export interface UseOnlineMatchResult {
  connectionState: OnlineConnectionState;
  room: RoomSnapshot | null;
  player: Player | null;
  reconnectToken: string | null;
  isPlayerTurn: boolean;
  playerLabel: string;
  opponentConnected: boolean;
  waitingForOpponent: boolean;
  createRoom: () => void;
  joinRoom: (roomId: string) => void;
  sendMove: (boardIndex: number, cellIndex: number) => boolean;
  resign: () => boolean;
  offerDraw: () => boolean;
  respondToDraw: (accept: boolean) => boolean;
  settle: () => boolean;
  resetSession: () => void;
}

function toPlayerLabel(player: Player | null): string {
  if (player === 'black') {
    return '黑方';
  }

  if (player === 'white') {
    return '白方';
  }

  return '未分配';
}

export function useOnlineMatch({
  onFeedback,
  onGameState,
  onOpenGameScreen,
  onClaimCelebration,
  onInvalidAction,
  socketFactory = createGameSocket,
}: UseOnlineMatchOptions): UseOnlineMatchResult {
  const [connectionState, setConnectionState] = useState<OnlineConnectionState>('offline');
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const previousBoardWinnersRef = useRef<Array<Player | null>>(createInitialState().boardWinners);
  const socketRef = useRef(socketFactory());
  const optionsRef = useRef({
    onFeedback,
    onGameState,
    onOpenGameScreen,
    onClaimCelebration,
    onInvalidAction,
  });

  useEffect(() => {
    optionsRef.current = {
      onFeedback,
      onGameState,
      onOpenGameScreen,
      onClaimCelebration,
      onInvalidAction,
    };
  }, [onClaimCelebration, onFeedback, onGameState, onInvalidAction, onOpenGameScreen]);

  const playerLabel = useMemo(() => toPlayerLabel(player), [player]);
  const isPlayerTurn = player !== null && gameState.currentPlayer === player;
  const opponentConnected = room?.players.find((item) => item.player !== player)?.connected ?? false;
  const waitingForOpponent = room?.players.length === 1;

  const applyGameState = (nextState: GameState) => {
    optionsRef.current.onClaimCelebration(previousBoardWinnersRef.current, nextState.boardWinners);
    previousBoardWinnersRef.current = nextState.boardWinners;
    setGameState(nextState);
    optionsRef.current.onGameState(nextState);
  };

  useEffect(() => {
    const socket = socketRef.current;

    const handleConnect = () => {
      setConnectionState('connected');
    };

    const handleDisconnect = () => {
      setConnectionState('offline');
    };

    const handleRoomCreated = (payload: { room: RoomSnapshot; player: Player; reconnectToken: string; message: string }) => {
      setRoom(payload.room);
      setPlayer(payload.player);
      setReconnectToken(payload.reconnectToken);
      applyGameState(payload.room.gameState);
      optionsRef.current.onOpenGameScreen('created');
      optionsRef.current.onFeedback({ message: payload.message, ok: true, revealSidebar: true });
    };

    const handleRoomJoined = (payload: { room: RoomSnapshot; player: Player; reconnectToken: string; message: string }) => {
      setRoom(payload.room);
      setPlayer(payload.player);
      setReconnectToken(payload.reconnectToken);
      applyGameState(payload.room.gameState);
      optionsRef.current.onOpenGameScreen('joined');
      optionsRef.current.onFeedback({ message: payload.message, ok: true, revealSidebar: true });
    };

    const handleRoomUpdate = (payload: RoomUpdatePayload) => {
      setRoom(payload.room);
      if (payload.room.players.length === 2) {
        optionsRef.current.onOpenGameScreen('joined');
      }
      optionsRef.current.onFeedback({ message: payload.message, ok: true });
    };

    const handleGameUpdate = (payload: GameUpdatePayload) => {
      setRoom((currentRoom) => (currentRoom ? { ...currentRoom, gameState: payload.state, updatedAt: Date.now() } : currentRoom));
      applyGameState(payload.state);
      optionsRef.current.onFeedback({
        message: payload.message,
        ok: true,
        revealSidebar: payload.state.pendingDrawOffer !== null,
      });
    };

    const handleGameEnded = (payload: GameEndedPayload) => {
      setRoom((currentRoom) => (currentRoom ? { ...currentRoom, gameState: payload.state, status: 'finished', updatedAt: Date.now() } : currentRoom));
      applyGameState(payload.state);
      optionsRef.current.onFeedback({ message: payload.message, ok: true, revealSidebar: true });
    };

    const handleGameError = (payload: GameErrorPayload) => {
      optionsRef.current.onFeedback({ message: payload.message, ok: false, revealSidebar: true });
      optionsRef.current.onInvalidAction?.();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room:created', handleRoomCreated);
    socket.on('room:joined', handleRoomJoined);
    socket.on('room:update', handleRoomUpdate);
    socket.on('game:update', handleGameUpdate);
    socket.on('game:ended', handleGameEnded);
    socket.on('game:error', handleGameError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room:created', handleRoomCreated);
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:update', handleRoomUpdate);
      socket.off('game:update', handleGameUpdate);
      socket.off('game:ended', handleGameEnded);
      socket.off('game:error', handleGameError);
      socket.disconnect();
    };
  }, []);

  const ensureConnected = () => {
    const socket = socketRef.current;
    if (!socket.connected) {
      setConnectionState('connecting');
      socket.connect();
    }

    return socket;
  };

  const withRoom = <T,>(fallbackMessage: string, callback: (roomId: string) => T): T | false => {
    if (!room) {
      optionsRef.current.onFeedback({ message: fallbackMessage, ok: false, revealSidebar: true });
      optionsRef.current.onInvalidAction?.();
      return false;
    }

    return callback(room.roomId);
  };

  const createRoom = () => {
    previousBoardWinnersRef.current = createInitialState().boardWinners;
    applyGameState(createInitialState());
    optionsRef.current.onFeedback({ message: '联机模式已准备就绪。正在为你创建房间...', ok: true, revealSidebar: true });
    ensureConnected().emit('room:create');
  };

  const joinRoom = (roomId: string) => {
    const normalizedRoomId = roomId.trim().toUpperCase();
    if (!normalizedRoomId) {
      optionsRef.current.onFeedback({ message: '请输入房间号后再加入。', ok: false, revealSidebar: true });
      optionsRef.current.onInvalidAction?.();
      return;
    }

    previousBoardWinnersRef.current = createInitialState().boardWinners;
    applyGameState(createInitialState());
    optionsRef.current.onFeedback({ message: `正在加入房间 ${normalizedRoomId}...`, ok: true, revealSidebar: true });
    ensureConnected().emit('room:join', {
      roomId: normalizedRoomId,
      reconnectToken: reconnectToken ?? undefined,
    });
  };

  const sendMove = (boardIndex: number, cellIndex: number) =>
    withRoom('当前还没有联机房间，请先建房或加入。', (roomId) => {
      if (!isPlayerTurn) {
        optionsRef.current.onFeedback({ message: '联机模式下当前不是你的回合。', ok: false, revealSidebar: true });
        optionsRef.current.onInvalidAction?.();
        return false;
      }

      ensureConnected().emit('game:move', { roomId, boardIndex, cellIndex });
      return true;
    }) || false;

  const resign = () =>
    withRoom('当前没有可操作的联机房间。', (roomId) => {
      ensureConnected().emit('game:resign', { roomId });
      return true;
    }) || false;

  const offerDraw = () =>
    withRoom('当前没有可操作的联机房间。', (roomId) => {
      ensureConnected().emit('game:offer-draw', { roomId });
      return true;
    }) || false;

  const respondToDraw = (accept: boolean) =>
    withRoom('当前没有可操作的联机房间。', (roomId) => {
      ensureConnected().emit('game:respond-draw', { roomId, accept });
      return true;
    }) || false;

  const settle = () =>
    withRoom('当前没有可操作的联机房间。', (roomId) => {
      ensureConnected().emit('game:settle', { roomId });
      return true;
    }) || false;

  const resetSession = () => {
    setRoom(null);
    setPlayer(null);
    setReconnectToken(null);
    setConnectionState('offline');
    previousBoardWinnersRef.current = createInitialState().boardWinners;
    applyGameState(createInitialState());
    socketRef.current.disconnect();
  };

  return {
    connectionState,
    room,
    player,
    reconnectToken,
    isPlayerTurn,
    playerLabel,
    opponentConnected,
    waitingForOpponent,
    createRoom,
    joinRoom,
    sendMove,
    resign,
    offerDraw,
    respondToDraw,
    settle,
    resetSession,
  };
}
