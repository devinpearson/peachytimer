import type { Light, Preset, RoomState, Thresholds } from "./timer";

export function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

/** The WebSocket URL for a room, on the same host as the API. */
export function socketUrl(code: string, base = apiBaseUrl()): string {
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/ws`;
  url.search = new URLSearchParams({ room: code }).toString();
  return url.toString();
}

export type Command =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "set-preset"; presetId: string }
  | { type: "set-thresholds"; label: string; thresholds: Thresholds }
  | { type: "set-light"; light: Light | null }
  | { type: "set-speaker"; speaker: string };

export interface RoomResponse {
  room: RoomState;
  serverTime: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

async function request<T>(path: string, init: RequestInit = {}, fetcher: Fetch = fetch): Promise<T> {
  const response = await fetcher(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(typeof body.error === "string" ? body.error : `Request failed (${response.status})`, response.status);
  }
  return body as T;
}

export function createRoom(presetId?: string, fetcher?: Fetch) {
  return request<RoomResponse & { controlToken: string }>(
    "/api/rooms",
    { method: "POST", body: JSON.stringify(presetId ? { presetId } : {}) },
    fetcher,
  );
}

export function getPresets(fetcher?: Fetch) {
  return request<{ presets: Preset[] }>("/api/presets", {}, fetcher);
}

export function sendCommand(code: string, token: string, command: Command, fetcher?: Fetch) {
  return request<RoomResponse>(
    `/api/rooms/${encodeURIComponent(code)}/commands`,
    { method: "POST", body: JSON.stringify(command), headers: { authorization: `Bearer ${token}` } },
    fetcher,
  );
}
