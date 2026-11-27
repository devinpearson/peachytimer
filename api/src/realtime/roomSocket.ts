import type { IncomingMessage, Server } from "node:http";
import { type WebSocket, WebSocketServer } from "ws";
import { type RoomStore, normaliseCode } from "../domain/roomStore";
import type { RoomState } from "../domain/timer";
import { logger } from "../utils/config";

/** Close code sent when the requested room doesn't exist (4000–4999 are free for apps). */
export const ROOM_NOT_FOUND = 4404;
const HEARTBEAT_MS = 30_000;

export type ServerMessage =
  | { type: "snapshot"; room: RoomState; serverTime: number }
  | { type: "closed"; code: string };

interface Client extends WebSocket {
  roomCode?: string;
  alive?: boolean;
}

/**
 * Viewers connect to /ws?room=CODE and receive the room's state on connect and after
 * every change. The socket is read-only: commands go through the REST API, which
 * checks the control token.
 */
export function attachRoomSocket(server: Server, store: RoomStore): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  const send = (ws: WebSocket, message: ServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  };

  wss.on("connection", (ws: Client, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const code = normaliseCode(url.searchParams.get("room") ?? "");
    const room = store.get(code);
    if (!room) {
      ws.close(ROOM_NOT_FOUND, "Room not found");
      return;
    }
    ws.roomCode = code;
    ws.alive = true;
    ws.on("pong", () => {
      ws.alive = true;
    });
    send(ws, { type: "snapshot", room, serverTime: Date.now() });
  });

  const onChange = (room: RoomState) => {
    for (const ws of wss.clients as Set<Client>) {
      if (ws.roomCode === room.code) send(ws, { type: "snapshot", room, serverTime: Date.now() });
    }
  };
  const onRemoved = (code: string) => {
    for (const ws of wss.clients as Set<Client>) {
      if (ws.roomCode === code) {
        send(ws, { type: "closed", code });
        ws.close(ROOM_NOT_FOUND, "Room expired");
      }
    }
  };
  store.on("change", onChange);
  store.on("removed", onRemoved);

  // Drop connections that stopped answering pings (a laptop lid closed mid-meeting).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<Client>) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  wss.on("close", () => {
    clearInterval(heartbeat);
    store.off("change", onChange);
    store.off("removed", onRemoved);
  });
  wss.on("error", (error) => logger.error("WebSocket server error", { error }));

  return wss;
}
