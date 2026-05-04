import { useMemo, useState } from 'react';
import {
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

export default function App() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [message, setMessage] = useState('第一手可在任意位置落子。');
  const legalBoards = useMemo(() => getLegalBoards(state), [state]);

  const handleMove = (boardIndex: number, cellIndex: number) => {
    const result = placeMove(state, boardIndex, cellIndex);
    setMessage(result.message);
    if (result.ok) {
      setState(result.state);
    }
  };

  const handleSettle = () => {
    const result = settleGame(state);
    setMessage(result.message);
    if (result.ok) {
      setState(result.state);
    }
  };

  const handleResign = () => {
    const nextState = resignGame(state, state.currentPlayer);
    setState(nextState);
    setMessage(`${playerLabel(state.currentPlayer)}认输，${playerLabel(nextState.settlement?.winner === 'white' ? 'white' : 'black')}获胜。`);
  };

  const handleOfferDraw = () => {
    const result = offerDraw(state, state.currentPlayer);
    setMessage(result.message);
    if (result.ok) {
      setState(result.state);
    }
  };

  const handleDrawResponse = (accept: boolean) => {
    const result = respondToDraw(state, accept);
    setMessage(result.message);
    if (result.ok) {
      setState(result.state);
    }
  };

  const reset = () => {
    setState(createInitialState());
    setMessage('已重开一局。第一手可在任意位置落子。');
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
            <strong>{state.boardWinners.filter((winner) => winner === 'black').length}</strong>
            <span>黑方占领</span>
          </div>
          <div>
            <span className="score-dot white" />
            <strong>{state.boardWinners.filter((winner) => winner === 'white').length}</strong>
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
          <button type="button" onClick={handleSettle} disabled={state.status !== 'playing'}>
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
                        className={`cell ${squareTone} ${cell ? `occupied ${cell}` : ''} ${isLastMove ? 'last-move' : ''}`}
                        key={`${boardIndex}-${cellIndex}`}
                        onClick={() => handleMove(boardIndex, cellIndex)}
                        disabled={disabled}
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
