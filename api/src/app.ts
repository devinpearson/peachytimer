import { type Server, createServer } from "node:http";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import type { WebSocketServer } from "ws";
import { RoomStore } from "./domain/roomStore";
import { attachRoomSocket } from "./realtime/roomSocket";
import { createRoomsRouter } from "./routes/rooms";
import { type Config, logger } from "./utils/config";

const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

export function createApp(store: RoomStore, config: Pick<Config, "corsOrigins">): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "10kb" }));
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("tiny", { stream: { write: (line) => logger.http(line.trim()) } }));
  }

  app.get("/api/health/live", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/health/ready", (_req, res) => {
    res.json({ status: "ok", rooms: store.size });
  });
  app.use("/api", createRoomsRouter(store));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: "Malformed JSON" });
      return;
    }
    logger.error("Unhandled error", { error });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

export interface RunningServer {
  server: Server;
  wss: WebSocketServer;
  store: RoomStore;
  stop(): Promise<void>;
}

export function startServer(config: Config, port = config.port): Promise<RunningServer> {
  const store = new RoomStore(config.roomTtlMs);
  const server = createServer(createApp(store, config));
  const wss = attachRoomSocket(server, store);
  const sweeper = setInterval(() => store.sweep(), SWEEP_INTERVAL_MS);
  sweeper.unref();

  const stop = () =>
    new Promise<void>((resolve, reject) => {
      clearInterval(sweeper);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      server.close((error) => (error ? reject(error) : resolve()));
    });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve({ server, wss, store, stop });
    });
  });
}
