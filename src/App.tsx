import { useMemo, useState } from 'react';
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

type MessageTone = 'info' | 'success' | 'warning';

export default function App() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [message, setMessage] = useState('第一手可在任意位置落子。');
  const [messageTone, setMessageTone] = useState<MessageTone>('info');
  const legalBoards = useMemo(() => getLegalBoards(state), [state]);
  const manualSettleAvailable = useMemo(() => canManualSettle(state), [state]);
  const blackClaims = state.boardWinners.filter((winner) => winner === 'black').length;
  const whiteClaims = state.boardWinners.filter((winner) => winner === 'white').length;

  const updateFeedback = (nextMessage: string, ok: boolean) => {
    setMessage(nextMessage);
    setMessageTone(ok ? 'success' : 'warning');
  };

  const handleMove = (boardIndex: number, cellIndex: number) => {
    const result = placeMove(state, boardIndex, cellIndex);
    updateFeedback(result.message, result.ok);
    if (result.ok) {
      setState(result.state);
    }
  };

  const handleSettle = () => {
    const result = settleGame(state);
    updateFeedback(result.message, result.ok);
    if (result.ok) {
      setState(result.state);
    }
  };

  const handleResign = () => {
    const nextState = resignGame(state, state.currentPlayer);
    setState(nextState);
    setMessage(`${playerLabel(state.currentPlayer)}认输，${playerLabel(nextState.settlement?.winner === 'white' ? 'white' : 'black')}获胜。`);
    setMessageTone('success');
  };

  const handleOfferDraw = () => {
    const result = offerDraw(state, state.currentPlayer);
    updateFeedback(result.message, result.ok);
    if (result.ok) {
      setState(result.state);
    }
  };

  const handleDrawResponse = (accept: boolean) => {
    const result = respondToDraw(state, accept);
    updateFeedback(result.message, result.ok);
    if (result.ok) {
      setState(result.state);
    }
  };

  const reset = () => {
    setState(createInitialState());
    setMessage('已重开一局。第一手可在任意位置落子。');
    setMessageTone('info');
  };

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

        <div className="status-card">
          <span className={`turn-stone ${state.currentPlayer}`} />
          <div>
            <strong>{statusText(state)}</strong>
            <small>{actionMessage(message)}</small>
          </div>
        </div>

        <div className="insight-grid" aria-label="对局信息面板">
          <article className="insight-card emphasis">
            <span className="insight-label">当前战场</span>
            <strong>{boardModeText(state)}</strong>
            <small>{lastMoveText(state)}</small>
          </article>

          <article className="insight-card">
            <span className="insight-label">主动结算</span>
            <strong>{manualSettleAvailable ? '现在可以结算' : '暂不可结算'}</strong>
            <small>{settlementHint(state)}</small>
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

        <div className="controls" aria-label="游戏操作">
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

      <section className="board-stage" aria-label="游戏棋盘">
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
                  className={`small-board ${boundaryClass} ${legalBoard ? 'legal' : 'locked'} ${winner ? `won ${winner}` : ''}`}
                  key={boardIndex}
                  aria-label={`小棋盘 ${boardIndex}${winner ? `，${playerLabel(winner)}已占领` : ''}`}
                >
                  <span className="small-board-index">#{boardIndex}</span>
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
                        className={`cell ${squareTone} ${cell ? `occupied ${cell}` : ''} ${isLastMove ? 'last-move' : ''} ${disabled ? 'is-disabled' : ''}`}
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
