/**
 * Types and timing rules mirrored from api/src/domain/timer.ts. The API owns the state;
 * the browser only needs these to draw the light and clock between snapshots.
 */
export type Light = "off" | "green" | "amber" | "red";
export type TimerStatus = "idle" | "running" | "paused";

export interface Thresholds {
  greenSec: number;
  amberSec: number;
  redSec: number;
}

export interface Preset {
  id: string;
  label: string;
  thresholds: Thresholds;
}

export interface HistoryEntry {
  speaker: string;
  label: string;
  durationMs: number;
  finishedAt: number;
  qualified: boolean;
}

export interface RoomState {
  code: string;
  createdAt: number;
  updatedAt: number;
  presetId: string | null;
  label: string;
  thresholds: Thresholds;
  status: TimerStatus;
  startedAt: number | null;
  accumulatedMs: number;
  manualLight: Light | null;
  speaker: string;
  history: HistoryEntry[];
}

export const GRACE_SEC = 30;

export function elapsedMs(room: Pick<RoomState, "status" | "startedAt" | "accumulatedMs">, serverNow: number): number {
  if (room.status === "running" && room.startedAt !== null) {
    return room.accumulatedMs + Math.max(0, serverNow - room.startedAt);
  }
  return room.accumulatedMs;
}

export function lightFor(thresholds: Thresholds, elapsed: number): Light {
  const sec = elapsed / 1000;
  if (sec >= thresholds.redSec) return "red";
  if (sec >= thresholds.amberSec) return "amber";
  if (sec >= thresholds.greenSec) return "green";
  return "off";
}

/** The light everyone should see: the timekeeper's manual choice wins over the clock. */
export function currentLight(room: RoomState, serverNow: number): Light {
  return room.manualLight ?? lightFor(room.thresholds, elapsedMs(room, serverNow));
}

/** True once the speaker is past the maximum plus the grace period. */
export function isOvertime(thresholds: Thresholds, elapsed: number): boolean {
  return elapsed / 1000 > thresholds.redSec + GRACE_SEC;
}

/** "m:ss" for a duration in milliseconds (rounded down to the second). */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatSeconds(sec: number): string {
  return formatDuration(sec * 1000);
}

/** Parses "m:ss", "m" or a plain number of minutes like "1.5" into whole seconds. */
export function parseDuration(text: string): number | null {
  const value = text.trim();
  const clock = value.match(/^(\d{1,2}):([0-5]\d)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d{1,2}(\.\d+)?$/.test(value)) return Math.round(Number(value) * 60);
  return null;
}

export const LIGHT_COLOURS: Record<Light, string> = {
  off: "#111827",
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#dc2626",
};

export const LIGHT_LABELS: Record<Light, string> = {
  off: "Off",
  green: "Green",
  amber: "Amber",
  red: "Red",
};
