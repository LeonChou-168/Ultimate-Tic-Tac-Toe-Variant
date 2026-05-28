export interface ServerConfig {
  port: number;
  clientOrigin: string;
  roomTtlMs: number;
  disconnectGraceMs: number;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: parsePositiveInteger(env.PORT, 3001),
    clientOrigin: env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    roomTtlMs: parsePositiveInteger(env.ROOM_TTL_MS, 30 * 60 * 1000),
    disconnectGraceMs: parsePositiveInteger(env.DISCONNECT_GRACE_MS, 5 * 60 * 1000),
  };
}
