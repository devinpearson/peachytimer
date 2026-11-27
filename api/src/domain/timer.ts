import { z } from "zod";

const LIGHTS = ["off", "green", "amber", "red"] as const;
type Light = (typeof LIGHTS)[number];

/** Seconds into the speech at which each card is shown. */
export const thresholdsSchema = z
  .object({
    greenSec: z.number().int().min(0).max(3600),
    amberSec: z.number().int().min(0).max(3600),
    redSec: z.number().int().min(1).max(3600),
  })
  .refine((t) => t.greenSec <= t.amberSec && t.amberSec <= t.redSec, {
    message: "Thresholds must be in order: green <= amber <= red",
  });
type Thresholds = z.infer<typeof thresholdsSchema>;

interface Preset {
  id: string;
  label: string;
  thresholds: Thresholds;
}

/**
 * Common Toastmasters timings. Green is the minimum time, red the maximum,
 * and amber sits halfway between.
 */
export const PRESETS: readonly Preset[] = [
  { id: "table-topics", label: "Table Topics (1–2 min)", thresholds: { greenSec: 60, amberSec: 90, redSec: 120 } },
  { id: "evaluation", label: "Evaluation (2–3 min)", thresholds: { greenSec: 120, amberSec: 150, redSec: 180 } },
  { id: "ice-breaker", label: "Ice Breaker (4–6 min)", thresholds: { greenSec: 240, amberSec: 300, redSec: 360 } },
  { id: "speech", label: "Prepared speech (5–7 min)", thresholds: { greenSec: 300, amberSec: 360, redSec: 420 } },
  { id: "long-speech", label: "Long speech (8–10 min)", thresholds: { greenSec: 480, amberSec: 540, redSec: 600 } },
  { id: "general-evaluation", label: "General Evaluation (5–7 min)", thresholds: { greenSec: 300, amberSec: 360, redSec: 420 } },
];

const DEFAULT_PRESET_ID = "speech";

/** A speaker may finish up to this long under the minimum or over the maximum and still qualify. */
const GRACE_SEC = 30;

function findPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

type TimerStatus = "idle" | "running" | "paused";

interface HistoryEntry {
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
  /** Epoch ms when the current running stretch began; null unless running. */
  startedAt: number | null;
  /** Time banked from earlier running stretches (before the last pause). */
  accumulatedMs: number;
  /** A light the timekeeper set by hand; overrides the automatic one while set. */
  manualLight: Light | null;
  speaker: string;
  history: HistoryEntry[];
}

export const HISTORY_LIMIT = 50;

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("reset") }),
  z.object({ type: z.literal("set-preset"), presetId: z.string() }),
  z.object({
    type: z.literal("set-thresholds"),
    label: z.string().trim().min(1).max(60),
    thresholds: thresholdsSchema,
  }),
  z.object({ type: z.literal("set-light"), light: z.enum(LIGHTS).nullable() }),
  z.object({ type: z.literal("set-speaker"), speaker: z.string().trim().max(80) }),
]);
export type Command = z.infer<typeof commandSchema>;

export class CommandError extends Error {}

export function elapsedMs(state: RoomState, now: number): number {
  if (state.status === "running" && state.startedAt !== null) {
    return state.accumulatedMs + Math.max(0, now - state.startedAt);
  }
  return state.accumulatedMs;
}

export function lightFor(thresholds: Thresholds, elapsed: number): Light {
  const sec = elapsed / 1000;
  if (sec >= thresholds.redSec) return "red";
  if (sec >= thresholds.amberSec) return "amber";
  if (sec >= thresholds.greenSec) return "green";
  return "off";
}

export function qualifies(thresholds: Thresholds, elapsed: number): boolean {
  const sec = elapsed / 1000;
  return sec >= thresholds.greenSec - GRACE_SEC && sec <= thresholds.redSec + GRACE_SEC;
}

export function createRoomState(code: string, now: number, presetId = DEFAULT_PRESET_ID): RoomState {
  const preset = findPreset(presetId);
  if (!preset) throw new CommandError(`Unknown preset: ${presetId}`);
  return {
    code,
    createdAt: now,
    updatedAt: now,
    presetId: preset.id,
    label: preset.label,
    thresholds: { ...preset.thresholds },
    status: "idle",
    startedAt: null,
    accumulatedMs: 0,
    manualLight: null,
    speaker: "",
    history: [],
  };
}

/** Applies a timekeeper command and returns the new state. Never mutates `state`. */
export function applyCommand(state: RoomState, command: Command, now: number): RoomState {
  const next: RoomState = { ...state, updatedAt: now };
  switch (command.type) {
    case "start":
      if (state.status === "running") return state;
      return { ...next, status: "running", startedAt: now };
    case "pause":
      if (state.status !== "running") return state;
      return { ...next, status: "paused", startedAt: null, accumulatedMs: elapsedMs(state, now) };
    case "reset": {
      const elapsed = elapsedMs(state, now);
      const history =
        elapsed > 0
          ? [
              {
                speaker: state.speaker,
                label: state.label,
                durationMs: elapsed,
                finishedAt: now,
                qualified: qualifies(state.thresholds, elapsed),
              },
              ...state.history,
            ].slice(0, HISTORY_LIMIT)
          : state.history;
      return {
        ...next,
        status: "idle",
        startedAt: null,
        accumulatedMs: 0,
        manualLight: null,
        speaker: "",
        history,
      };
    }
    case "set-preset": {
      const preset = findPreset(command.presetId);
      if (!preset) throw new CommandError(`Unknown preset: ${command.presetId}`);
      return { ...next, presetId: preset.id, label: preset.label, thresholds: { ...preset.thresholds } };
    }
    case "set-thresholds":
      return { ...next, presetId: null, label: command.label, thresholds: command.thresholds };
    case "set-light":
      return { ...next, manualLight: command.light };
    case "set-speaker":
      return { ...next, speaker: command.speaker };
  }
}
