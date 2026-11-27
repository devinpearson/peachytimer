import { describe, expect, it } from "vitest";
import { currentLight, elapsedMs, formatDuration, isOvertime, lightFor, parseDuration, type RoomState } from "./timer";

const T = { greenSec: 60, amberSec: 90, redSec: 120 };

const room = (over: Partial<RoomState> = {}): RoomState => ({
  code: "ABCDE",
  createdAt: 0,
  updatedAt: 0,
  presetId: "table-topics",
  label: "Table Topics",
  thresholds: T,
  status: "idle",
  startedAt: null,
  accumulatedMs: 0,
  manualLight: null,
  speaker: "",
  history: [],
  ...over,
});

describe("elapsedMs", () => {
  it("adds the running stretch to banked time", () => {
    expect(elapsedMs(room({ status: "running", startedAt: 1000, accumulatedMs: 500 }), 3000)).toBe(2500);
  });
  it("never goes backwards if the clocks disagree", () => {
    expect(elapsedMs(room({ status: "running", startedAt: 5000, accumulatedMs: 0 }), 4000)).toBe(0);
  });
  it("is the banked time while paused", () => {
    expect(elapsedMs(room({ status: "paused", accumulatedMs: 7000 }), 99_000)).toBe(7000);
  });
});

describe("lightFor and currentLight", () => {
  it.each([
    [59_999, "off"],
    [60_000, "green"],
    [90_000, "amber"],
    [120_000, "red"],
  ] as const)("%sms → %s", (ms, light) => {
    expect(lightFor(T, ms)).toBe(light);
  });

  it("prefers the manual light", () => {
    expect(currentLight(room({ manualLight: "red" }), 0)).toBe("red");
    expect(currentLight(room({ status: "paused", accumulatedMs: 95_000 }), 0)).toBe("amber");
  });
});

describe("isOvertime", () => {
  it("allows 30 seconds past red", () => {
    expect(isOvertime(T, 150_000)).toBe(false);
    expect(isOvertime(T, 150_001)).toBe(true);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [999, "0:00"],
    [61_500, "1:01"],
    [600_000, "10:00"],
    [-5, "0:00"],
  ])("%sms is %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("parseDuration", () => {
  it.each([
    ["4:30", 270],
    [" 0:45 ", 45],
    ["5", 300],
    ["1.5", 90],
    ["4:60", null],
    ["abc", null],
    ["", null],
  ])("%j is %s seconds", (text, sec) => {
    expect(parseDuration(text)).toBe(sec);
  });
});
