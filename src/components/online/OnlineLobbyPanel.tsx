import GlassSurface from '../GlassSurface';

interface OnlineLobbyPanelProps {
  activeRoomId?: string | null;
  copyLabel?: string;
  roomIdInput: string;
  onRoomIdChange: (value: string) => void;
  onCopyRoomId?: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export default function OnlineLobbyPanel({
  activeRoomId,
  copyLabel = '复制房间号',
  roomIdInput,
  onRoomIdChange,
  onCopyRoomId,
  onCreateRoom,
  onJoinRoom,
}: OnlineLobbyPanelProps) {
  return (
    <GlassSurface tag="section" borderRadius={24} className="mode-card online-mode-card">
      <strong>联机对战</strong>
      <span>{activeRoomId ? '房间已经建好，把房间号发给对方后等待加入。' : '先起本地 Socket 服务，再建房或输入房间号加入。'}</span>
      {activeRoomId ? (
        <div className="online-room-ready">
          <div className="online-room-ready-copy">
            <small>当前房间号</small>
            <strong>{activeRoomId}</strong>
          </div>
          <GlassSurface tag="button" borderRadius={999} className="ghost-button online-cta" onClick={onCopyRoomId}>
            {copyLabel}
          </GlassSurface>
        </div>
      ) : null}
      <div className="online-entry-actions">
        <GlassSurface tag="button" borderRadius={999} className="ghost-button online-cta" onClick={onCreateRoom}>
          {activeRoomId ? '重新建房' : '建房'}
        </GlassSurface>
        <label className="online-room-input">
          <span className="sr-only">房间号</span>
          <input
            type="text"
            value={roomIdInput}
            maxLength={6}
            placeholder="输入房间号"
            onChange={(event) => onRoomIdChange(event.target.value.toUpperCase())}
          />
        </label>
        <GlassSurface tag="button" borderRadius={999} className="ghost-button online-cta" onClick={onJoinRoom}>
          加入
        </GlassSurface>
      </div>
    </GlassSurface>
  );
}
