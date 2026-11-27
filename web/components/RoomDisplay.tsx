"use client";

import Link from "next/link";
import { useState } from "react";
import { useRoom, useTick, useWakeLock } from "@/hooks/useRoom";
import { currentLight, elapsedMs, formatDuration, LIGHT_COLOURS, LIGHT_LABELS } from "@/lib/timer";

/** The speaker's view: the whole screen is the light. */
export default function RoomDisplay({ code }: { code: string }) {
  const { room, status, serverNow } = useRoom(code);
  const [showClock, setShowClock] = useState(false);
  useTick(room?.status === "running");
  useWakeLock(status === "live");

  if (status === "not-found") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 p-6 text-center text-white">
        <h1 className="text-2xl font-semibold">Room {code} isn&apos;t running</h1>
        <p className="text-gray-400">It may have expired. Ask the timekeeper for a new code.</p>
        <Link href="/" className="underline">
          Back to Peachy Timer
        </Link>
      </main>
    );
  }

  const now = serverNow();
  const light = room ? currentLight(room, now) : "off";
  const elapsed = room ? elapsedMs(room, now) : 0;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <main
      data-testid="light"
      data-light={light}
      aria-label={`Timing light: ${LIGHT_LABELS[light]}`}
      className="relative flex min-h-screen select-none flex-col items-center justify-center transition-colors duration-300"
      style={{ backgroundColor: LIGHT_COLOURS[light] }}
    >
      <div className="absolute left-4 top-4 flex items-center gap-3 rounded-full bg-black/30 px-3 py-1 text-sm text-white/90">
        <span className="font-mono tracking-widest">{code}</span>
        {status !== "live" && <span>{status === "connecting" ? "Connecting…" : "Reconnecting…"}</span>}
      </div>
      <div className="absolute right-4 top-4 flex gap-2">
        <button
          type="button"
          onClick={() => setShowClock((s) => !s)}
          className="rounded-full bg-black/30 px-3 py-1 text-sm text-white/90 hover:bg-black/50"
        >
          {showClock ? "Hide clock" : "Show clock"}
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-full bg-black/30 px-3 py-1 text-sm text-white/90 hover:bg-black/50"
        >
          Full screen
        </button>
      </div>

      {room && (
        <div className="text-center text-white/90">
          {showClock && (
            <p data-testid="display-clock" className="font-mono text-[18vw] font-bold leading-none tabular-nums">
              {formatDuration(elapsed)}
            </p>
          )}
          {room.speaker && <p className="mt-4 text-3xl font-medium">{room.speaker}</p>}
          {room.status === "idle" && !showClock && light === "off" && (
            <p className="text-xl text-white/60">Waiting for the timekeeper · {room.label}</p>
          )}
        </div>
      )}
    </main>
  );
}
