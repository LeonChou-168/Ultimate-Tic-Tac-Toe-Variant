import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { Request, Response } from 'express';
import { loadConfig } from './config';
import { registerSocketHandlers } from './socket-events';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from './types';

const config = loadConfig();
const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: {
    origin: config.clientOrigin,
    methods: ['GET', 'POST'],
  },
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

registerSocketHandlers(io, config);

httpServer.listen(config.port, () => {
  console.log(`Ultimate Tic-Tac-Toe Variant server listening on http://localhost:${config.port}`);
});
