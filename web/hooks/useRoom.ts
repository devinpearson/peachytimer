"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { socketUrl, type RoomResponse } from "@/lib/api";
import type { RoomState } from "@/lib/timer";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "not-found";

const ROOM_NOT_FOUND = 4404;
const MAX_BACKOFF_MS = 10_000;

/**
 * Follows a room over the API's WebSocket, reconnecting with backoff. `serverNow()` is the
 * browser's clock corrected to the server's, so every screen in the room agrees on the time.
 */
export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const offsetRef = useRef(0);

  const applySnapshot = useCallback((snapshot: RoomResponse) => {
    offsetRef.current = snapshot.serverTime - Date.now();
    setRoom((current) =>
      // Ignore a snapshot older than the one already shown (a command reply racing the socket).
      current && current.updatedAt > snapshot.room.updatedAt ? current : snapshot.room,
    );
  }, []);

  useEffect(() => {
    let ws: WebSocket | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const open = () => {
      ws = new WebSocket(socketUrl(code));
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === "snapshot") {
          attempt = 0;
          applySnapshot(message);
          setStatus("live");
        }
      };
      ws.onclose = (event) => {
        if (stopped) return;
        if (event.code === ROOM_NOT_FOUND) {
          setStatus("not-found");
          return;
        }
        setStatus("reconnecting");
        retryTimer = setTimeout(open, Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt++));
      };
    };

    open();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [code, applySnapshot]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  return { room, status, serverNow, applySnapshot };
}

/** Re-renders on an interval while `active`, for a ticking clock. */
export function useTick(active: boolean, intervalMs = 200): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}

/** Keeps the screen awake while `active` (a phone or projector showing the light). */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let released = false;
    const acquire = () => {
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (released) void l.release();
          else lock = l;
        })
        .catch(() => {});
    };
    const onVisible = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}
