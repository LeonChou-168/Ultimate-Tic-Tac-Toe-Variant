import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { GameState, Player } from './game/types';
import { playSound, setSoundVolume } from './sound';

function playerLabel(player: Player): string {
  return player === 'black' ? '黑方' : '白方';
}

function statusText(state: GameState): string {
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

type MessageTone = 'info' | 'success' | 'warning';

type TutorialStep = {
  key: 'status' | 'battlefield' | 'board' | 'controls';
  label: string;
  title: string;
  body: string;
};

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

const fallbackTutorialStep: TutorialStep = {
  key: 'status',
  label: '第 1 步',
  title: '先看当前轮到谁，以及系统刚刚反馈了什么',
  body: '这里会告诉你当前行棋方，以及上一操作为什么成功、为什么失败。每次犹豫时，先看这一栏。',
};

export default function App() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [message, setMessage] = useState('第一手可在任意位置落子。');
  const [messageTone, setMessageTone] = useState<MessageTone>('info');
  const [showGuide, setShowGuide] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoveHints, setShowMoveHints] = useState(true);
  const [enableStoneAnimation, setEnableStoneAnimation] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundVolume, setSoundVolumeState] = useState(72);
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [celebratingBoards, setCelebratingBoards] = useState<number[]>([]);
  const legalBoards = useMemo(() => getLegalBoards(state), [state]);
  const manualSettleAvailable = useMemo(() => canManualSettle(state), [state]);
  const blackClaims = state.boardWinners.filter((winner) => winner === 'black').length;
  const whiteClaims = state.boardWinners.filter((winner) => winner === 'white').length;
  const previousClaimCountRef = useRef(blackClaims + whiteClaims);

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

    const timeoutId = window.setTimeout(() => {
      setCelebratingBoards([]);
    }, 760);

    return () => window.clearTimeout(timeoutId);
  }, [celebratingBoards]);

  const triggerClaimCelebration = (previousWinners: Array<Player | null>, nextWinners: Array<Player | null>) => {
    const newClaimedBoards = nextWinners
      .map((winner, index) => ({ winner, index }))
      .filter(({ winner, index }) => winner !== null && previousWinners[index] !== winner)
      .map(({ index }) => index);

    if (newClaimedBoards.length > 0) {
      setCelebratingBoards(newClaimedBoards);
    }
  };

  const updateFeedback = (nextMessage: string, ok: boolean) => {
    setMessage(nextMessage);
    setMessageTone(ok ? 'success' : 'warning');
  };

  const handleMove = (boardIndex: number, cellIndex: number) => {
    const result = placeMove(state, boardIndex, cellIndex);
    updateFeedback(result.message, result.ok);

    if (!result.ok) {
      maybePlaySound('invalid');
    }

    if (result.ok) {
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
    }
  };

  const handleSettle = () => {
    const result = settleGame(state);
    updateFeedback(result.message, result.ok);
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
    maybePlaySound('resign');
  };

  const handleOfferDraw = () => {
    const result = offerDraw(state, state.currentPlayer);
    updateFeedback(result.message, result.ok);
    maybePlaySound(result.ok ? 'draw-offer' : 'invalid');
    if (result.ok) {
      setState(result.state);
    }
  };

  const handleDrawResponse = (accept: boolean) => {
    const result = respondToDraw(state, accept);
    updateFeedback(result.message, result.ok);
    if (!result.ok) {
      maybePlaySound('invalid');
    } else {
      maybePlaySound(accept ? 'draw-accepted' : 'draw-declined');
    }
    if (result.ok) {
      previousClaimCountRef.current = result.state.boardWinners.filter(Boolean).length;
      setState(result.state);
    }
  };

  const reset = () => {
    setState(createInitialState());
    setMessage('已重开一局。第一手可在任意位置落子。');
    setMessageTone('info');
    previousClaimCountRef.current = 0;
  };

  const currentTutorialStep: TutorialStep = tutorialSteps[tutorialStepIndex] ?? fallbackTutorialStep;
  const recentMoves = [...state.history].slice(-8).reverse();

  useEffect(() => {
    if (!showTutorial) {
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
  }, [manualSettleAvailable, showTutorial, state.history.length, state.pendingDrawOffer, state.status]);

  const nextTutorialStep = () => {
    setTutorialStepIndex((index) => Math.min(index + 1, tutorialSteps.length - 1));
  };

  const previousTutorialStep = () => {
    setTutorialStepIndex((index) => Math.max(index - 1, 0));
  };

  const restartTutorial = () => {
    setTutorialStepIndex(0);
    setShowTutorial(true);
  };

  const tutorialHighlight = (key: TutorialStep['key']): string => (showTutorial && currentTutorialStep.key === key ? 'tutorial-focus' : '');

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="game-title">
        <div className="eyebrow">Ultimate Tic-Tac-Toe Variant</div>
        <h1 id="game-title">终极井字棋变体</h1>
        <p>
          9 个小棋盘互相投影，上一手的位置决定下一手的战场。占领更多小棋盘的一方赢得整局。
        </p>

        <div className="score-card" aria-label="当前占领小棋盘数量">
          <div>
            <span className="score-dot black" />
            <strong>{blackClaims}</strong>
            <span>黑方占领</span>
          </div>
          <div>
            <span className="score-dot white" />
            <strong>{whiteClaims}</strong>
            <span>白方占领</span>
          </div>
        </div>

        <div className={`status-card ${tutorialHighlight('status')}`}>
          <span className={`turn-stone ${state.currentPlayer}`} />
          <div>
            <strong>{statusText(state)}</strong>
            <small>{actionMessage(message)}</small>
          </div>
        </div>

        {state.settlement ? (
          <section className={`endgame-panel ${settlementTheme(state)}`} aria-label="对局结果总结">
            <div className="panel-heading">
              <span className="insight-label">终局总结</span>
              <strong>{settlementTitle(state)}</strong>
            </div>
            <p className="endgame-reason">{settlementReasonText(state)}</p>
            <div className="endgame-stats">
              <div>
                <span>黑方占领</span>
                <strong>{state.settlement.blackBoards}</strong>
              </div>
              <div>
                <span>白方占领</span>
                <strong>{state.settlement.whiteBoards}</strong>
              </div>
            </div>
          </section>
        ) : null}

        <div className="top-actions" aria-label="辅助面板控制">
          <button type="button" className="ghost-button" onClick={() => setShowGuide((value) => !value)}>
            {showGuide ? '收起新手引导' : '查看新手引导'}
          </button>
          <button type="button" className="ghost-button" onClick={() => setShowSettings((value) => !value)}>
            {showSettings ? '收起设置面板' : '打开设置面板'}
          </button>
          <button type="button" className="ghost-button" onClick={() => (showTutorial ? setShowTutorial(false) : restartTutorial())}>
            {showTutorial ? '关闭分步教程' : '重开分步教程'}
          </button>
        </div>

        {showGuide ? (
          <section className="guide-panel" aria-label="新手引导">
            <div className="panel-heading">
              <span className="insight-label">新手引导</span>
              <strong>三步看懂这一局怎么下</strong>
            </div>
            <ol className="guide-list">
              <li>
                <strong>第一手任意落子</strong>
                <span>开局时可以直接点任意一个未占领小棋盘里的空位。</span>
              </li>
              <li>
                <strong>之后看“当前位置编号”投影</strong>
                <span>上一手落在小棋盘里的第几格，下一手就必须去编号相同的小棋盘。</span>
              </li>
              <li>
                <strong>看高亮区域，不用硬记规则</strong>
                <span>金色高亮区域就是当前允许落子的战场；如果没有指定区域，就代表自由落子。</span>
              </li>
            </ol>
          </section>
        ) : null}

        {showTutorial ? (
          <section className="tutorial-panel" aria-label="分步教程">
            <div className="panel-heading">
              <span className="insight-label">分步教程</span>
              <strong>{currentTutorialStep.title}</strong>
            </div>

            <div className="tutorial-progress" aria-label="教程进度">
              {tutorialSteps.map((step, index) => (
                <span
                  key={step.key}
                  className={`tutorial-dot ${index === tutorialStepIndex ? 'active' : ''} ${index < tutorialStepIndex ? 'done' : ''}`}
                />
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
        ) : null}

        {showSettings ? (
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
              <button
                type="button"
                className={`toggle-button ${enableStoneAnimation ? 'active' : ''}`}
                onClick={() => setEnableStoneAnimation((value) => !value)}
              >
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
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={soundVolume}
                  onChange={(event) => setSoundVolumeState(Number(event.target.value))}
                />
                <span>{soundVolume}%</span>
              </label>
            </div>
          </section>
        ) : null}

        <div className="insight-grid" aria-label="对局信息面板">
          <article className={`insight-card emphasis ${tutorialHighlight('battlefield')}`}>
            <span className="insight-label">当前战场</span>
            <strong>{boardModeText(state)}</strong>
            <small>{showMoveHints ? lastMoveText(state) : '你已关闭落子引导提示，可随时在设置中重新开启。'}</small>
          </article>

          <article className="insight-card">
            <span className="insight-label">主动结算</span>
            <strong>{manualSettleAvailable ? '现在可以结算' : '暂不可结算'}</strong>
            <small>{showMoveHints ? settlementHint(state) : '需要时可重新开启提示查看当前是否满足主动结算条件。'}</small>
          </article>

          <article className="insight-card">
            <span className="insight-label">求和次数</span>
            <strong>黑方剩余 {3 - state.drawOfferCounts.black} 次 · 白方剩余 {3 - state.drawOfferCounts.white} 次</strong>
            <small>
              {state.pendingDrawOffer
                ? `${playerLabel(state.pendingDrawOffer.offeredBy)}已发起求和，等待回应。`
                : '当前没有待处理的求和请求。'}
            </small>
          </article>

          <article className="insight-card history-card">
            <span className="insight-label">最近手顺</span>
            {recentMoves.length > 0 ? (
              <ol className="history-list">
                {recentMoves.map((move, index) => (
                  <li key={`${move.boardIndex}-${move.cellIndex}-${state.history.length - index}`}>
                    <strong>{state.history.length - index}.</strong>
                    <span>
                      {playerLabel(move.player)}落在小棋盘 {move.boardIndex} 的位置 {move.cellIndex}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="history-empty">对局还没开始。第一手可以直接落在任意可用位置。</p>
            )}
          </article>
        </div>

        <div className={`message-card ${messageTone}`} role="status" aria-live="polite">
          <span className="message-label">操作反馈</span>
          <strong>{actionMessage(message)}</strong>
          <small>现在即使点到非法位置，也会明确告诉你原因。</small>
        </div>

        {state.pendingDrawOffer ? (
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

        <div className={`controls ${tutorialHighlight('controls')}`} aria-label="游戏操作">
          <button type="button" onClick={handleSettle} disabled={state.status !== 'playing' || !manualSettleAvailable}>
            主动结算
          </button>
          <button type="button" onClick={handleOfferDraw} disabled={state.status !== 'playing'}>
            求和 ({3 - state.drawOfferCounts[state.currentPlayer]} 次)
          </button>
          <button type="button" onClick={handleResign} disabled={state.status !== 'playing'}>
            认输
          </button>
          <button type="button" className="primary" onClick={reset}>
            重新开始
          </button>
        </div>
      </section>

      <section className={`board-stage ${tutorialHighlight('board')}`} aria-label="游戏棋盘">
        <div className="board-frame">
          <div className="macro-board">
            {state.boards.map((board, boardIndex) => {
              const winner = state.boardWinners[boardIndex];
              const legalBoard = legalBoards.includes(boardIndex);
              const boardRow = Math.floor(boardIndex / 3);
              const boardColumn = boardIndex % 3;
              const boundaryClass = [
                boardColumn < 2 ? 'with-right-divider' : '',
                boardRow < 2 ? 'with-bottom-divider' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div
                  className={`small-board ${boundaryClass} ${legalBoard ? 'legal' : 'locked'} ${winner ? `won ${winner}` : ''} ${celebratingBoards.includes(boardIndex) ? 'claim-burst' : ''}`}
                  key={boardIndex}
                  aria-label={`小棋盘 ${boardIndex}${winner ? `，${playerLabel(winner)}已占领` : ''}`}
                >
                  {board.map((cell, cellIndex) => {
                    const isLastMove =
                      state.lastMove?.boardIndex === boardIndex && state.lastMove.cellIndex === cellIndex;
                    const cellRow = Math.floor(cellIndex / 3);
                    const cellColumn = cellIndex % 3;
                    const globalRow = boardRow * 3 + cellRow;
                    const globalColumn = boardColumn * 3 + cellColumn;
                    const squareTone = (globalRow + globalColumn) % 2 === 0 ? 'light-square' : 'dark-square';
                    const disabled = state.status !== 'playing' || Boolean(cell) || Boolean(winner) || !legalBoard;
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
    </main>
  );
}
