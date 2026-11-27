import { describe, expect, it } from "@jest/globals";
import {
  CommandError,
  HISTORY_LIMIT,
  PRESETS,
  applyCommand,
  commandSchema,
  createRoomState,
  elapsedMs,
  lightFor,
  qualifies,
  thresholdsSchema,
} from "./timer";

const T = { greenSec: 300, amberSec: 360, redSec: 420 };
const sec = (s: number) => s * 1000;

describe("lightFor", () => {
  it.each([
    [0, "off"],
    [299.9, "off"],
    [300, "green"],
    [359, "green"],
    [360, "amber"],
    [419, "amber"],
    [420, "red"],
    [900, "red"],
  ])("at %ss shows %s", (s, light) => {
    expect(lightFor(T, sec(s))).toBe(light);
  });
});

describe("qualifies", () => {
  it.each([
    [269, false],
    [270, true],
    [450, true],
    [451, false],
  ])("a %ss speech qualifies: %s", (s, ok) => {
    expect(qualifies(T, sec(s))).toBe(ok);
  });
});

describe("thresholdsSchema", () => {
  it("rejects thresholds out of order", () => {
    expect(thresholdsSchema.safeParse({ greenSec: 60, amberSec: 30, redSec: 90 }).success).toBe(false);
  });
  it("accepts equal thresholds", () => {
    expect(thresholdsSchema.safeParse({ greenSec: 60, amberSec: 60, redSec: 60 }).success).toBe(true);
  });
});

describe("presets", () => {
  it("are all valid and uniquely named", () => {
    for (const p of PRESETS) expect(thresholdsSchema.safeParse(p.thresholds).success).toBe(true);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });
});

describe("applyCommand", () => {
  const fresh = () => createRoomState("ABCDE", 0);

  it("creates rooms from a preset and rejects unknown ones", () => {
    expect(createRoomState("X", 0, "table-topics").thresholds.redSec).toBe(120);
    expect(() => createRoomState("X", 0, "nope")).toThrow(CommandError);
  });

  it("accumulates time across pause and resume", () => {
    let s = applyCommand(fresh(), { type: "start" }, 1_000);
    expect(s.status).toBe("running");
    expect(elapsedMs(s, 4_000)).toBe(3_000);
    s = applyCommand(s, { type: "pause" }, 4_000);
    expect(s.status).toBe("paused");
    expect(elapsedMs(s, 99_000)).toBe(3_000);
    s = applyCommand(s, { type: "start" }, 10_000);
    expect(elapsedMs(s, 12_000)).toBe(5_000);
  });

  it("ignores start while running and pause while not running", () => {
    const running = applyCommand(fresh(), { type: "start" }, 1_000);
    expect(applyCommand(running, { type: "start" }, 2_000)).toBe(running);
    const idle = fresh();
    expect(applyCommand(idle, { type: "pause" }, 2_000)).toBe(idle);
  });

  it("records the speech in history on reset and clears the timer", () => {
    let s = applyCommand(fresh(), { type: "set-speaker", speaker: "Ted" }, 0);
    s = applyCommand(s, { type: "set-light", light: "red" }, 0);
    s = applyCommand(s, { type: "start" }, 0);
    s = applyCommand(s, { type: "reset" }, sec(330));
    expect(s).toMatchObject({ status: "idle", accumulatedMs: 0, manualLight: null, speaker: "" });
    expect(s.history[0]).toMatchObject({ speaker: "Ted", durationMs: sec(330), qualified: true });
  });

  it("doesn't record a reset of an unstarted timer", () => {
    expect(applyCommand(fresh(), { type: "reset" }, 5_000).history).toHaveLength(0);
  });

  it("caps history", () => {
    let s = fresh();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      s = applyCommand(s, { type: "start" }, i * 10);
      s = applyCommand(s, { type: "reset" }, i * 10 + 5);
    }
    expect(s.history).toHaveLength(HISTORY_LIMIT);
  });

  it("switches presets and custom thresholds", () => {
    let s = applyCommand(fresh(), { type: "set-preset", presetId: "evaluation" }, 0);
    expect(s).toMatchObject({ presetId: "evaluation", thresholds: { redSec: 180 } });
    s = applyCommand(s, { type: "set-thresholds", label: "Custom", thresholds: { greenSec: 1, amberSec: 2, redSec: 3 } }, 0);
    expect(s).toMatchObject({ presetId: null, label: "Custom", thresholds: { redSec: 3 } });
    expect(() => applyCommand(s, { type: "set-preset", presetId: "nope" }, 0)).toThrow(CommandError);
  });

  it("does not mutate the previous state", () => {
    const s = fresh();
    applyCommand(s, { type: "set-speaker", speaker: "Ann" }, 5);
    expect(s.speaker).toBe("");
  });
});

describe("commandSchema", () => {
  it("rejects unknown commands and lights", () => {
    expect(commandSchema.safeParse({ type: "explode" }).success).toBe(false);
    expect(commandSchema.safeParse({ type: "set-light", light: "blue" }).success).toBe(false);
    expect(commandSchema.safeParse({ type: "set-light", light: null }).success).toBe(true);
  });
});
