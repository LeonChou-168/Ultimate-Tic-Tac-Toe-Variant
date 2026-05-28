import GlassSurface from '../GlassSurface';
import type { OnlineConnectionState } from '../../online/useOnlineMatch';
import type { RoomSnapshot } from '../../online/types';

interface OnlineStatusCardProps {
  connectionState: OnlineConnectionState;
  room: RoomSnapshot | null;
  playerLabel: string;
  opponentConnected: boolean;
  waitingForOpponent: boolean;
}

function connectionMessage(
  connectionState: OnlineConnectionState,
  waitingForOpponent: boolean,
  opponentConnected: boolean,
): string {
  if (connectionState === 'connecting') {
    return '正在连接联机服务器...';
  }

  if (connectionState === 'connected') {
    return waitingForOpponent
      ? '房间已建立，等待另一位玩家加入。'
      : `连接正常 · 对手${opponentConnected ? '在线' : '暂时离线'}`;
  }

  return '当前未连接到联机服务器。请先启动后端并重新建房或加入。';
}

export default function OnlineStatusCard({
  connectionState,
  room,
  playerLabel,
  opponentConnected,
  waitingForOpponent,
}: OnlineStatusCardProps) {
  return (
    <GlassSurface tag="section" width="100%" height="auto" borderRadius={22} className="insight-card horizontal-status-card">
      <span className="insight-label">联机状态</span>
      <strong>{room ? `房间 ${room.roomId} · 你是${playerLabel}` : '尚未进入房间'}</strong>
      <small>{connectionMessage(connectionState, waitingForOpponent, opponentConnected)}</small>
    </GlassSurface>
  );
}
