import { describe, expect, it, jest } from "@jest/globals";
import { RoomStore } from "./roomStore";

describe("RoomStore", () => {
  it("creates rooms with readable codes and finds them case-insensitively", () => {
    const store = new RoomStore(1000);
    const { room } = store.create();
    expect(room.code).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
    expect(store.get(room.code.toLowerCase())).toBe(room);
    expect(store.get("ZZZZZZ")).toBeUndefined();
  });

  it("only accepts the room's own control token", () => {
    const store = new RoomStore(1000);
    const a = store.create();
    const b = store.create();
    expect(store.canControl(a.room.code, a.controlToken)).toBe(true);
    expect(store.canControl(a.room.code, b.controlToken)).toBe(false);
    expect(store.canControl(a.room.code, "short")).toBe(false);
    expect(store.canControl("NOPE1", a.controlToken)).toBe(false);
  });

  it("emits change only when a command changes the state", () => {
    const store = new RoomStore(1000);
    const { room } = store.create();
    const listener = jest.fn();
    store.on("change", listener);
    store.apply(room.code, { type: "start" });
    store.apply(room.code, { type: "start" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.apply("NOPE1", { type: "start" })).toBeUndefined();
  });

  it("sweeps idle rooms past the TTL but keeps running ones", () => {
    let now = 0;
    const store = new RoomStore(1000, () => now);
    const idle = store.create();
    const running = store.create();
    store.apply(running.room.code, { type: "start" });
    const removed = jest.fn();
    store.on("removed", removed);

    now = 500;
    expect(store.sweep()).toEqual([]);
    now = 2000;
    expect(store.sweep()).toEqual([idle.room.code]);
    expect(removed).toHaveBeenCalledWith(idle.room.code);
    expect(store.size).toBe(1);
  });
});
