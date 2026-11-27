import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiBaseUrl, createRoom, getPresets, sendCommand, socketUrl } from "./api";

afterEach(() => {
  vi.unstubAllEnvs();
});

const json = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("URLs", () => {
  it("defaults to the local API and trims trailing slashes", () => {
    expect(apiBaseUrl()).toBe("http://localhost:4000");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://timer-api.example.com/");
    expect(apiBaseUrl()).toBe("https://timer-api.example.com");
  });

  it("builds ws and wss socket URLs", () => {
    expect(socketUrl("ABCDE", "http://localhost:4000")).toBe("ws://localhost:4000/ws?room=ABCDE");
    expect(socketUrl("ABCDE", "https://api.example.com/timer/")).toBe("wss://api.example.com/timer/ws?room=ABCDE");
  });
});

describe("requests", () => {
  it("creates a room with or without a preset", async () => {
    const fetcher = json(201, { room: { code: "ABCDE" }, controlToken: "t", serverTime: 1 });
    await createRoom("evaluation", fetcher);
    await createRoom(undefined, fetcher);
    expect(fetcher.mock.calls[0]).toEqual([
      "http://localhost:4000/api/rooms",
      expect.objectContaining({ method: "POST", body: '{"presetId":"evaluation"}' }),
    ]);
    expect((fetcher.mock.calls[1] as unknown[])[1]).toMatchObject({ body: "{}" });
  });

  it("sends commands with the bearer token", async () => {
    const fetcher = json(200, { room: {}, serverTime: 1 });
    await sendCommand("AB CD", "secret", { type: "start" }, fetcher);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/api/rooms/AB%20CD/commands");
    expect(init.headers).toMatchObject({ authorization: "Bearer secret", "content-type": "application/json" });
  });

  it("raises the API's error message", async () => {
    await expect(getPresets(json(403, { error: "No access" }))).rejects.toEqual(new ApiError("No access", 403));
  });

  it("falls back to a generic message when the body isn't JSON", async () => {
    const fetcher = vi.fn(async () => new Response("oops", { status: 502 }));
    await expect(getPresets(fetcher)).rejects.toMatchObject({ message: "Request failed (502)", status: 502 });
  });
});
