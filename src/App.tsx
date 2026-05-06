import { useEffect, useMemo, useRef, useState } from 'react';
import { chooseAIMove } from './game/ai';
import {
  canManualSettle,
  createInitialState,
  formatPlayer,
  getLegalBoards,
  offerDraw,
  placeMove,
  respondToDraw,
  resignGame,
  settleGame,
} from './game/engine';
import type { GameMode, GameState, Player } from './game/types';
import { playSound, setSoundVolume } from './sound';

type MessageTone = 'info' | 'success' | 'warning';
type Screen = 'welcome' | 'menu' | 'game';

type TutorialStep = {
  key: 'status' | 'battlefield' | 'board' | 'controls';
  label: string;
  title: string;
  body: string;
};

type SidebarSection = 'menu' | 'status' | 'actions' | 'replay' | 'settings' | 'tutorial';

const tutorialSteps: TutorialStep[] = [
  {
    key: 'status',
    label: '第 1 步',
    title: '先看当前轮到谁，以及系统刚刚反馈了什么',
    body: '这里会告诉你当前行棋方，以及上一操作为什么成功、为什么失败。每次犹豫时，先看这一栏。',
  },
  {
    key: 'battlefield',
    label: '第 2 步',
    title: '再看当前战场：指定落子还是自由落子',
    body: '如果这里写“必须落在某个小棋盘”，就只去那个区域；如果写“自由落子”，你可以在所有可用区域里任选。',
  },
  {
    key: 'board',
    label: '第 3 步',
    title: '然后去看棋盘上的高亮与上一手痕迹',
    body: '金色高亮表示当前可落子的战场，蓝色边框表示上一手位置。两者结合起来，就能快速理解投影规则。',
  },
  {
    key: 'controls',
    label: '第 4 步',
    title: '最后再使用动作按钮处理特殊局面',
    body: '求和、认输、主动结算、重新开始都在这里。只有规则允许时，相应按钮才会进入可用状态。',
  },
];

const fallbackTutorialStep: TutorialStep = tutorialSteps[0] ?? {
  key: 'status',
  label: '第 1 步',
  title: '先看当前轮到谁',
  body: '先看状态栏。',
};

function playerLabel(player: Player): string {
  return player === 'black' ? '黑方' : '白方';
}

function actionMessage(message: string): string {
  return message || '第一手可在任意位置落子。';
}

function boardModeText(state: GameState): string {
  if (state.status !== 'playing') {
    return '对局已结束';
  }

  if (state.targetBoard === null) {
    return '当前为自由落子';
  }

  return `当前必须落在小棋盘 ${state.targetBoard}`;
}

function lastMoveText(state: GameState): string {
  if (!state.lastMove) {
    return '暂无上一手记录';
  }

  return `${playerLabel(state.lastMove.player)}刚刚落在小棋盘 ${state.lastMove.boardIndex} 的位置 ${state.lastMove.cellIndex}`;
}

function settlementHint(state: GameState): string {
  if (state.status !== 'playing') {
    return '对局已结束，不能再主动结算。';
  }

  return canManualSettle(state)
    ? '当前所有未占领小棋盘都已无胜方可能，可主动结算。'
    : '当前仍存在可争夺的小棋盘，暂不能主动结算。';
}

function settlementReasonText(state: GameState): string {
  if (!state.settlement) {
    return '';
  }

  switch (state.settlement.reason) {
    case 'automatic':
      return '所有可行棋区域都已结束，系统已自动结算本局。';
    case 'manual':
      return '当前所有未占领小棋盘都已无胜方可能，因此触发了主动结算。';
    case 'resignation':
      return '一方已认输，对局提前结束。';
    case 'draw-agreed':
      return '双方接受和棋，本局以平局收尾。';
  }
}

function settlementTitle(state: GameState): string {
  if (!state.settlement) {
    return '';
  }

  if (state.settlement.winner === 'draw') {
    return '本局平局';
  }

  return `${formatPlayer(state.settlement.winner)}取得胜利`;
}

function settlementTheme(state: GameState): 'black' | 'white' | 'draw' {
  if (!state.settlement || state.settlement.winner === 'draw') {
    return 'draw';
  }

  return state.settlement.winner;
}

function statusHeadline(state: GameState): string {
  if (state.settlement) {
    if (state.settlement.winner === 'draw') {
      return `本局平局 · 黑 ${state.settlement.blackBoards} : ${state.settlement.whiteBoards} 白`;
    }

    return `${formatPlayer(state.settlement.winner)}获胜 · 黑 ${state.settlement.blackBoards} : ${state.settlement.whiteBoards} 白`;
  }

  if (state.targetBoard === null) {
    return `${playerLabel(state.currentPlayer)}行棋 · 可在任意可用区域落子`;
  }

  return `${playerLabel(state.currentPlayer)}行棋 · 请在高亮区域落子`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [gameMode, setGameMode] = useState<GameMode>('human-vs-human');
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [message, setMessage] = useState('欢迎来到终极井字棋变体。');
  const [messageTone, setMessageTone] = useState<MessageTone>('info');
  const [showMoveHints, setShowMoveHints] = useState(true);
  const [enableStoneAnimation, setEnableStoneAnimation] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundVolume, setSoundVolumeState] = useState(72);
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [celebratingBoards, setCelebratingBoards] = useState<number[]>([]);
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>('menu');
  const [replayMode, setReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [aiPending, setAiPending] = useState(false);
  const [aiPlayer] = useState<Player>('white');

  const previousClaimCountRef = useRef(0);
  const manualSettleAvailable = useMemo(() => canManualSettle(state), [state]);
  const currentTutorialStep: TutorialStep = tutorialSteps[tutorialStepIndex] ?? fallbackTutorialStep;
  const replayState = useMemo(() => {
    let next = createInitialState();
    for (let i = 0; i < replayIndex; i += 1) {
      const move = state.history[i];
      if (!move) {
        break;
      }

      const result = placeMove(next, move.boardIndex, move.cellIndex);
      if (!result.ok) {
        break;
      }

      next = result.state;
    }
    return next;
  }, [replayIndex, state.history]);
  const displayState = replayMode ? replayState : state;
  const displayLegalBoards = useMemo(() => (replayMode ? [] : getLegalBoards(state)), [replayMode, state]);

  const maybePlaySound = (cue: Parameters<typeof playSound>[0]) => {
    if (!soundEnabled) {
      return;
    }
    playSound(cue);
  };

  useEffect(() => {
    setSoundVolume(soundVolume / 100);
  }, [soundVolume]);

  useEffect(() => {
    if (celebratingBoards.length === 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setCelebratingBoards([]), 760);
    return () => window.clearTimeout(timeoutId);
  }, [celebratingBoards]);

  useEffect(() => {
    if (!showTutorial || replayMode) {
      return;
    }

    if (state.status !== 'playing' || state.pendingDrawOffer || manualSettleAvailable) {
      setTutorialStepIndex((index) => Math.max(index, 3));
      return;
    }

    if (state.history.length >= 2) {
      setTutorialStepIndex((index) => Math.max(index, 2));
      return;
    }

    if (state.history.length >= 1) {
      setTutorialStepIndex((index) => Math.max(index, 1));
    }
  }, [manualSettleAvailable, replayMode, showTutorial, state.history.length, state.pendingDrawOffer, state.status]);

  useEffect(() => {
    if (screen !== 'game' || replayMode || gameMode !== 'human-vs-ai' || aiPending) {
      return;
    }

    if (state.status !== 'playing' || state.currentPlayer !== aiPlayer) {
      return;
    }

    const move = chooseAIMove(state, aiPlayer);
    if (!move) {
      return;
    }

    setAiPending(true);
    const timeoutId = window.setTimeout(() => {
      setAiPending(false);
      handleMove(move.boardIndex, move.cellIndex, true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [aiPending, aiPlayer, gameMode, replayMode, screen, state]);

  useEffect(() => {
    if (screen !== 'game') {
      setSidebarVisible(true);
      return undefined;
    }

    if (sidebarPinned) {
      setSidebarVisible(true);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSidebarVisible(false);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [message, replayMode, screen, sidebarPinned, sidebarVisible, state]);

  const triggerClaimCelebration = (previousWinners: Array<Player | null>, nextWinners: Array<Player | null>) => {
    const newClaimedBoards = nextWinners
      .map((winner, index) => ({ winner, index }))
      .filter(({ winner, index }) => winner !== null && previousWinners[index] !== winner)
      .map(({ index }) => index);

    if (newClaimedBoards.length > 0) {
      setCelebratingBoards(newClaimedBoards);
    }
  };

  const updateFeedback = (nextMessage: string, ok: boolean, options?: { revealSidebar?: boolean }) => {
    setMessage(nextMessage);
    setMessageTone(ok ? 'success' : 'warning');
    if (options?.revealSidebar) {
      setSidebarVisible(true);
    }
  };

  const handleMove = (boardIndex: number, cellIndex: number, fromAI = false) => {
    if (replayMode) {
      return;
    }

    if (!fromAI && gameMode === 'human-vs-ai' && state.currentPlayer === aiPlayer) {
      updateFeedback('现在轮到电脑思考，请稍等。', false);
      return;
    }

    const result = placeMove(state, boardIndex, cellIndex);
    updateFeedback(result.message, result.ok, { revealSidebar: !result.ok });

    if (!result.ok) {
      maybePlaySound('invalid');
      return;
    }

    const previousClaims = previousClaimCountRef.current;
    const nextClaims = result.state.boardWinners.filter(Boolean).length;
    triggerClaimCelebration(state.boardWinners, result.state.boardWinners);

    if (result.state.status === 'settled') {
      maybePlaySound('settlement');
    } else if (nextClaims > previousClaims) {
      maybePlaySound('claim');
    } else {
      maybePlaySound('move');
    }

    previousClaimCountRef.current = nextClaims;
    setState(result.state);
  };

  const handleSettle = () => {
    const result = settleGame(state);
    updateFeedback(result.message, result.ok, { revealSidebar: true });
    maybePlaySound(result.ok ? 'settlement' : 'invalid');
    if (result.ok) {
      previousClaimCountRef.current = result.state.boardWinners.filter(Boolean).length;
      setState(result.state);
    }
  };

  const handleResign = () => {
    const nextState = resignGame(state, state.currentPlayer);
    setState(nextState);
    setMessage(`${playerLabel(state.currentPlayer)}认输，${playerLabel(nextState.settlement?.winner === 'white' ? 'white' : 'black')}获胜。`);
    setMessageTone('success');
    previousClaimCountRef.current = nextState.boardWinners.filter(Boolean).length;
    setSidebarVisible(true);
    setSidebarSection('status');
    maybePlaySound('resign');
  };

  const handleOfferDraw = () => {
    const result = offerDraw(state, state.currentPlayer);
    updateFeedback(result.message, result.ok, { revealSidebar: true });
    maybePlaySound(result.ok ? 'draw-offer' : 'invalid');
    if (result.ok) {
      setState(result.state);
    }
  };

  const handleDrawResponse = (accept: boolean) => {
    const result = respondToDraw(state, accept);
    updateFeedback(result.message, result.ok, { revealSidebar: true });
    maybePlaySound(!result.ok ? 'invalid' : accept ? 'draw-accepted' : 'draw-declined');
    if (result.ok) {
      previousClaimCountRef.current = result.state.boardWinners.filter(Boolean).length;
      setState(result.state);
    }
  };

  const beginGame = (mode: GameMode) => {
    setGameMode(mode);
    setState(createInitialState());
    setScreen('game');
    setReplayMode(false);
    setReplayIndex(0);
    setAiPending(false);
    setMessage(mode === 'human-vs-ai' ? '人机对战开始。你执黑先手，电脑执白后手。' : '双人对战开始。第一手可在任意位置落子。');
    setMessageTone('info');
    setSidebarVisible(true);
    setSidebarSection('menu');
    previousClaimCountRef.current = 0;
  };

  const reset = () => {
    beginGame(gameMode);
  };

  const restartTutorial = () => {
    setTutorialStepIndex(0);
    setShowTutorial(true);
  };

  const nextTutorialStep = () => {
    setTutorialStepIndex((index) => Math.min(index + 1, tutorialSteps.length - 1));
  };

  const previousTutorialStep = () => {
    setTutorialStepIndex((index) => Math.max(index - 1, 0));
  };

  const tutorialHighlight = (key: TutorialStep['key']): string => (showTutorial && currentTutorialStep.key === key ? 'tutorial-focus' : '');

  const openReplay = () => {
    setReplayMode(true);
    setReplayIndex(state.history.length);
    setSidebarVisible(true);
    setSidebarSection('replay');
  };

  const closeReplay = () => {
    setReplayMode(false);
    setSidebarVisible(true);
    setSidebarSection('menu');
  };

  const gameShellClass = `app-shell game-shell ${sidebarVisible ? 'sidebar-visible' : 'sidebar-hidden'} ${sidebarPinned ? 'sidebar-pinned' : 'sidebar-floating'}`;
  const sidebarExpanded = sidebarVisible || sidebarPinned;
  const sidebarEntries: Array<{ key: Exclude<SidebarSection, 'menu'>; label: string; summary: string }> = [
    { key: 'status', label: '对局状态', summary: '查看当前轮次、战场与终局摘要' },
    { key: 'actions', label: '操作', summary: '求和、认输、结算与重开' },
    { key: 'replay', label: '回放', summary: '进入落子回溯演示模式' },
    { key: 'settings', label: '设置', summary: '音效、动效、提示与侧栏方式' },
    { key: 'tutorial', label: '教程', summary: '查看分步教程与新手引导' },
  ];

  if (screen === 'welcome') {
    return (
      <main className="landing-screen">
        <section className="welcome-card">
          <div className="eyebrow">Ultimate Tic-Tac-Toe Variant</div>
          <h1>欢迎来到终极井字棋变体</h1>
          <div className="welcome-actions">
            <button type="button" className="hero-button primary" onClick={() => setScreen('menu')}>
              进入主菜单
            </button>
            <button type="button" className="hero-button" onClick={() => beginGame('human-vs-human')}>
              直接开始双人对战
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === 'menu') {
    return (
      <main className="landing-screen menu-screen">
        <section className="welcome-card menu-card">
          <div className="eyebrow">开始一局</div>
          <h1>选择你的对战方式</h1>
          <div className="menu-grid">
            <button type="button" className="mode-card" onClick={() => beginGame('human-vs-human')}>
              <strong>本地双人</strong>
              <span>两位玩家轮流在同一棋盘上对弈。</span>
            </button>
            <button type="button" className="mode-card" onClick={() => beginGame('human-vs-ai')}>
              <strong>人机对战</strong>
              <span>你执黑先手，电脑执白应对，先体验一版轻量策略 AI。</span>
            </button>
          </div>
          <div className="welcome-actions">
            <button type="button" className="hero-button" onClick={() => setScreen('welcome')}>
              返回欢迎页
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={gameShellClass}>
      <section className="board-stage fullscreen-board" aria-label="游戏棋盘">
        <div className="board-frame board-frame-large">
          <div className="macro-board">
            {displayState.boards.map((board, boardIndex) => {
              const winner = displayState.boardWinners[boardIndex];
              const legalBoard = displayLegalBoards.includes(boardIndex);
              const boardRow = Math.floor(boardIndex / 3);
              const boardColumn = boardIndex % 3;
              const boundaryClass = [boardColumn < 2 ? 'with-right-divider' : '', boardRow < 2 ? 'with-bottom-divider' : '']
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  className={`small-board ${boundaryClass} ${legalBoard ? 'legal' : 'locked'} ${winner ? `won ${winner}` : ''} ${celebratingBoards.includes(boardIndex) ? 'claim-burst' : ''}`}
                  key={boardIndex}
                  aria-label={`小棋盘 ${boardIndex}${winner ? `，${playerLabel(winner)}已占领` : ''}`}
                >
                  {board.map((cell, cellIndex) => {
                    const isLastMove = displayState.lastMove?.boardIndex === boardIndex && displayState.lastMove.cellIndex === cellIndex;
                    const cellRow = Math.floor(cellIndex / 3);
                    const cellColumn = cellIndex % 3;
                    const globalRow = boardRow * 3 + cellRow;
                    const globalColumn = boardColumn * 3 + cellColumn;
                    const squareTone = (globalRow + globalColumn) % 2 === 0 ? 'light-square' : 'dark-square';
                    const disabled =
                      replayMode ||
                      displayState.status !== 'playing' ||
                      Boolean(cell) ||
                      Boolean(winner) ||
                      !legalBoard ||
                      aiPending;

                    return (
                      <button
                        type="button"
                        className={`cell ${squareTone} ${cell ? `occupied ${cell}` : ''} ${isLastMove ? 'last-move' : ''} ${disabled ? 'is-disabled' : ''} ${enableStoneAnimation ? 'animated-stone' : 'static-stone'}`}
                        key={`${boardIndex}-${cellIndex}`}
                        onClick={() => handleMove(boardIndex, cellIndex)}
                        aria-disabled={disabled}
                        aria-label={`小棋盘 ${boardIndex}，位置 ${cellIndex}${cell ? `，${playerLabel(cell)}棋子` : ''}`}
                      >
                        {cell ? <span className={`stone ${cell}`} /> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div
        className="sidebar-trigger-zone"
        onMouseEnter={() => setSidebarVisible(true)}
        onFocus={() => setSidebarVisible(true)}
        aria-hidden="true"
      />

      <aside
        className={`control-sidebar ${sidebarExpanded ? 'expanded' : 'collapsed'}`}
        onMouseEnter={() => setSidebarVisible(true)}
        onMouseLeave={() => {
          if (!sidebarPinned) {
            setSidebarVisible(false);
          }
        }}
      >
        <div className="compact-rail" aria-hidden={sidebarExpanded}>
          <button type="button" className="rail-chip mode-chip" onClick={() => setSidebarVisible(true)} aria-label="展开侧边栏">
            <span>{gameMode === 'human-vs-ai' ? 'AI' : 'VS'}</span>
          </button>
          <span className={`rail-stone ${displayState.currentPlayer}`} />
          <div className="rail-score">
            <strong>{displayState.boardWinners.filter((winner) => winner === 'black').length}</strong>
            <span>:</span>
            <strong>{displayState.boardWinners.filter((winner) => winner === 'white').length}</strong>
          </div>
          <button type="button" className="rail-chip pin-chip" onClick={() => setSidebarPinned((value) => !value)} aria-label="切换侧边栏固定状态">
            <span>{sidebarPinned ? '锁' : '悬'}</span>
          </button>
          <div className="rail-pulse" />
        </div>

        <div className="sidebar-scroll full-sidebar-content">
          <section className="sidebar-header">
            <div>
              <div className="eyebrow">{gameMode === 'human-vs-ai' ? 'Human vs AI' : 'Local Versus'}</div>
              <h2>侧边指挥台</h2>
              <p>{replayMode ? '当前处于落子回溯演示模式。' : '状态、回放、设置与操作都集中在这里。'}</p>
            </div>
            <div className="sidebar-top-buttons">
              <button type="button" className="ghost-button" onClick={() => setSidebarPinned((value) => !value)}>
                {sidebarPinned ? '改为自动淡出' : '固定侧边栏'}
              </button>
              <button type="button" className="ghost-button" onClick={() => setSidebarVisible(false)}>
                收起侧栏
              </button>
              {sidebarSection !== 'menu' ? (
                <button type="button" className="ghost-button" onClick={() => setSidebarSection('menu')}>
                  返回词条
                </button>
              ) : null}
              <button type="button" className="ghost-button" onClick={() => setScreen('menu')}>
                返回菜单
              </button>
            </div>
          </section>

          {sidebarSection === 'menu' ? (
            <section className="sidebar-menu-panel" aria-label="侧边栏词条列表">
              <div className="panel-heading">
                <span className="insight-label">词条</span>
                <strong>选择你要查看或操作的模块</strong>
              </div>
              <div className="sidebar-entry-list">
                {sidebarEntries.map((entry) => (
                  <button key={entry.key} type="button" className="sidebar-entry" onClick={() => setSidebarSection(entry.key)}>
                    <strong>{entry.label}</strong>
                    <small>{entry.summary}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {sidebarSection === 'status' ? (
            <section className={`status-card ${tutorialHighlight('status')}`}>
            <span className={`turn-stone ${displayState.currentPlayer}`} />
            <div>
              <strong>{statusHeadline(displayState)}</strong>
              <small>{aiPending ? '电脑正在思考下一手。' : actionMessage(message)}</small>
            </div>
            </section>
          ) : null}

          {sidebarSection === 'status' && displayState.settlement ? (
            <section className={`endgame-panel ${settlementTheme(displayState)}`} aria-label="对局结果总结">
              <div className="panel-heading">
                <span className="insight-label">终局总结</span>
                <strong>{settlementTitle(displayState)}</strong>
              </div>
              <p className="endgame-reason">{settlementReasonText(displayState)}</p>
              <div className="endgame-stats">
                <div>
                  <span>黑方占领</span>
                  <strong>{displayState.settlement.blackBoards}</strong>
                </div>
                <div>
                  <span>白方占领</span>
                  <strong>{displayState.settlement.whiteBoards}</strong>
                </div>
              </div>
            </section>
          ) : null}

          {sidebarSection === 'tutorial' && showTutorial ? (
            <section className="tutorial-panel" aria-label="分步教程">
              <div className="panel-heading">
                <span className="insight-label">分步教程</span>
                <strong>{currentTutorialStep.title}</strong>
              </div>
              <div className="tutorial-progress" aria-label="教程进度">
                {tutorialSteps.map((step, index) => (
                  <span key={step.key} className={`tutorial-dot ${index === tutorialStepIndex ? 'active' : ''} ${index < tutorialStepIndex ? 'done' : ''}`} />
                ))}
              </div>
              <div className="tutorial-copy">
                <span className="tutorial-step-label">{currentTutorialStep.label}</span>
                <p>{currentTutorialStep.body}</p>
                <small className="tutorial-auto-note">教程会随着你的实际对局进度自动推进，你也可以手动切换步骤。</small>
              </div>
              <div className="tutorial-actions">
                <button type="button" className="ghost-button" onClick={previousTutorialStep} disabled={tutorialStepIndex === 0}>
                  上一步
                </button>
                <button type="button" className="ghost-button" onClick={restartTutorial}>
                  从头再看
                </button>
                <button
                  type="button"
                  className="ghost-button tutorial-primary"
                  onClick={tutorialStepIndex === tutorialSteps.length - 1 ? () => setShowTutorial(false) : nextTutorialStep}
                >
                  {tutorialStepIndex === tutorialSteps.length - 1 ? '完成教程' : '下一步'}
                </button>
              </div>
            </section>
          ) : sidebarSection === 'tutorial' ? (
            <button type="button" className="ghost-button" onClick={() => setShowTutorial(true)}>
              重新打开教程
            </button>
          ) : null}

          {sidebarSection === 'status' ? (
            <div className="insight-grid sidebar-grid" aria-label="对局信息面板">
            <article className={`insight-card emphasis ${tutorialHighlight('battlefield')}`}>
              <span className="insight-label">当前战场</span>
              <strong>{boardModeText(displayState)}</strong>
              <small>{showMoveHints ? lastMoveText(displayState) : '你已关闭落子引导提示，可随时在设置中重新开启。'}</small>
            </article>

            <article className="insight-card">
              <span className="insight-label">主动结算</span>
              <strong>{manualSettleAvailable ? '现在可以结算' : '暂不可结算'}</strong>
              <small>{showMoveHints ? settlementHint(state) : '需要时可重新开启提示查看当前是否满足主动结算条件。'}</small>
            </article>

            <article className="insight-card">
              <span className="insight-label">求和次数</span>
              <strong>黑方剩余 {3 - state.drawOfferCounts.black} 次 · 白方剩余 {3 - state.drawOfferCounts.white} 次</strong>
              <small>{state.pendingDrawOffer ? `${playerLabel(state.pendingDrawOffer.offeredBy)}已发起求和，等待回应。` : '当前没有待处理的求和请求。'}</small>
            </article>
            </div>
          ) : null}

          {sidebarSection === 'replay' ? (
            <section className="replay-panel">
            <div className="panel-heading">
              <span className="insight-label">落子回溯演示</span>
              <strong>{replayMode ? `正在回看第 ${replayIndex} 手` : '落子回溯'}</strong>
            </div>
            <p className="history-empty">
              {state.history.length > 0
                ? '可拖动进度回看当前棋局的形成过程。'
                : '等对局开始后，这里会根据实际落子生成回放。'}
            </p>
            <div className="replay-controls">
              <button type="button" className="ghost-button" onClick={() => setReplayIndex((index) => Math.max(index - 1, 0))} disabled={!replayMode || replayIndex === 0}>
                上一手
              </button>
              <button type="button" className="ghost-button" onClick={() => (replayMode ? closeReplay() : openReplay())} disabled={state.history.length === 0}>
                {replayMode ? '退出回放' : '进入回放'}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setReplayIndex((index) => Math.min(index + 1, state.history.length))}
                disabled={!replayMode || replayIndex >= state.history.length}
              >
                下一手
              </button>
            </div>
            {replayMode ? (
              <label className="volume-slider replay-slider" aria-label="回放进度滑杆">
                <input type="range" min="0" max={state.history.length} step="1" value={replayIndex} onChange={(event) => setReplayIndex(Number(event.target.value))} />
                <span>{replayIndex} / {state.history.length} 手</span>
              </label>
            ) : null}
            </section>
          ) : null}

          {sidebarSection === 'status' ? (
            <div className={`message-card ${messageTone}`} role="status" aria-live="polite">
            <span className="message-label">操作反馈</span>
            <strong>{actionMessage(message)}</strong>
            <small>{replayMode ? '回放模式下主棋盘不可落子，只用于观察局面演化。' : '鼠标移到右边缘即可再次唤出侧边栏，固定模式下则不会自动淡出。'}</small>
            </div>
          ) : null}

          {sidebarSection === 'actions' && state.pendingDrawOffer && !replayMode ? (
            <div className="draw-banner">
              <span>{playerLabel(state.pendingDrawOffer.offeredBy)}请求和棋</span>
              <button type="button" onClick={() => handleDrawResponse(true)}>
                接受
              </button>
              <button type="button" onClick={() => handleDrawResponse(false)}>
                拒绝
              </button>
            </div>
          ) : null}

          {sidebarSection === 'actions' ? (
            <div className={`controls sidebar-controls ${tutorialHighlight('controls')}`} aria-label="游戏操作">
            <button type="button" onClick={handleSettle} disabled={replayMode || state.status !== 'playing' || !manualSettleAvailable || aiPending}>
              主动结算
            </button>
            <button type="button" onClick={handleOfferDraw} disabled={replayMode || state.status !== 'playing' || gameMode === 'human-vs-ai' || aiPending}>
              求和 ({3 - state.drawOfferCounts[state.currentPlayer]} 次)
            </button>
            <button type="button" onClick={handleResign} disabled={replayMode || state.status !== 'playing' || aiPending}>
              认输
            </button>
            <button type="button" className="primary" onClick={reset}>
              重新开始
            </button>
            </div>
          ) : null}

          {sidebarSection === 'settings' ? (
            <section className="settings-panel" aria-label="局内设置">
            <div className="panel-heading">
              <span className="insight-label">局内设置</span>
              <strong>把信息密度调成你舒服的样子</strong>
            </div>

            <div className="setting-row">
              <div>
                <strong>显示落子引导</strong>
                <small>关闭后保留核心规则，但弱化信息面板中的提示依赖。</small>
              </div>
              <button type="button" className={`toggle-button ${showMoveHints ? 'active' : ''}`} onClick={() => setShowMoveHints((value) => !value)}>
                {showMoveHints ? '已开启' : '已关闭'}
              </button>
            </div>

            <div className="setting-row">
              <div>
                <strong>棋子落下动效</strong>
                <small>关闭后仍可正常对局，只是不再强调落子瞬间的动态反馈。</small>
              </div>
              <button type="button" className={`toggle-button ${enableStoneAnimation ? 'active' : ''}`} onClick={() => setEnableStoneAnimation((value) => !value)}>
                {enableStoneAnimation ? '已开启' : '已关闭'}
              </button>
            </div>

            <div className="setting-row">
              <div>
                <strong>音效开关</strong>
                <small>已接入轻量合成音：落子、占领、和棋、结算、认输和非法操作都会有不同反馈。</small>
              </div>
              <button type="button" className={`toggle-button ${soundEnabled ? 'active' : ''}`} onClick={() => setSoundEnabled((value) => !value)}>
                {soundEnabled ? '已开启' : '已关闭'}
              </button>
            </div>

            <div className="setting-row slider-row">
              <div>
                <strong>音量强度</strong>
                <small>当前音量 {soundVolume}% 。关闭音效后仍可提前调好，下次开启立即生效。</small>
              </div>
              <label className="volume-slider" aria-label="音量滑杆">
                <input type="range" min="0" max="100" step="1" value={soundVolume} onChange={(event) => setSoundVolumeState(Number(event.target.value))} />
                <span>{soundVolume}%</span>
              </label>
            </div>
            </section>
          ) : null}
        </div>
      </aside>
    </main>
  );
}
