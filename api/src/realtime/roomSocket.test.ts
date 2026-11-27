import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import WebSocket from "ws";
import { type RunningServer, startServer } from "../app";
import { ROOM_NOT_FOUND, type ServerMessage } from "./roomSocket";

let running: RunningServer;
let base: string;

beforeEach(async () => {
  running = await startServer({ port: 0, logLevel: "error", corsOrigins: [], roomTtlMs: 1 }, 0);
  const { port } = running.server.address() as AddressInfo;
  base = `ws://127.0.0.1:${port}/ws`;
});

afterEach(async () => {
  await running.stop();
});

/** Opens a socket and collects every message it receives. */
function connect(room: string) {
  const ws = new WebSocket(`${base}?room=${room}`);
  const messages: ServerMessage[] = [];
  const waiters: Array<() => void> = [];
  ws.on("message", (data) => {
    messages.push(JSON.parse(data.toString()));
    waiters.splice(0).forEach((w) => w());
  });
  const next = (count: number) =>
    new Promise<ServerMessage>((resolve) => {
      const check = () => (messages.length >= count ? resolve(messages[count - 1]) : waiters.push(check));
      check();
    });
  const closed = new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));
  return { ws, next, closed };
}

describe("room socket", () => {
  it("sends a snapshot on connect and after each change", async () => {
    const { room } = running.store.create();
    const client = connect(room.code.toLowerCase());
    const first = await client.next(1);
    expect(first).toMatchObject({ type: "snapshot", room: { code: room.code, status: "idle" } });

    running.store.apply(room.code, { type: "start" });
    expect(await client.next(2)).toMatchObject({ type: "snapshot", room: { status: "running" } });
    client.ws.close();
  });

  it("doesn't send other rooms' changes", async () => {
    const a = running.store.create();
    const b = running.store.create();
    const client = connect(a.room.code);
    await client.next(1);
    running.store.apply(b.room.code, { type: "start" });
    running.store.apply(a.room.code, { type: "set-speaker", speaker: "Ann" });
    expect(await client.next(2)).toMatchObject({ room: { code: a.room.code, speaker: "Ann" } });
    client.ws.close();
  });

  it("closes with 4404 for an unknown room", async () => {
    expect(await connect("NOPE1").closed).toBe(ROOM_NOT_FOUND);
  });

  it("tells viewers when their room expires", async () => {
    const { room } = running.store.create();
    const client = connect(room.code);
    await client.next(1);
    await new Promise((r) => setTimeout(r, 5));
    running.store.sweep();
    expect(await client.next(2)).toEqual({ type: "closed", code: room.code });
    expect(await client.closed).toBe(ROOM_NOT_FOUND);
  });
});
