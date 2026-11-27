import { describe, expect, it } from "vitest";
import { controlLink, displayLink, normaliseRoomCode, recallToken, rememberToken, tokenFromHash } from "./controlTokens";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe("control tokens", () => {
  it("remembers tokens per room, ignoring case", () => {
    const store = memory();
    rememberToken("abcde", "t1", store);
    expect(recallToken("ABCDE", store)).toBe("t1");
    expect(recallToken("ZZZZZ", store)).toBeNull();
  });

  it("copes with no storage or storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(() => rememberToken("ABCDE", "t", broken)).not.toThrow();
    expect(recallToken("ABCDE", broken)).toBeNull();
    expect(recallToken("ABCDE", null)).toBeNull();
    // No window in the test environment, so the default store is null.
    expect(recallToken("ABCDE")).toBeNull();
  });

  it("reads the token from a URL fragment", () => {
    expect(tokenFromHash("#token=a%2Bb")).toBe("a+b");
    expect(tokenFromHash("")).toBeNull();
  });

  it("builds share links", () => {
    expect(displayLink("https://t.example", "ABCDE")).toBe("https://t.example/room/ABCDE");
    expect(controlLink("https://t.example", "ABCDE", "a+b")).toBe("https://t.example/room/ABCDE/control#token=a%2Bb");
  });

  it.each([
    ["k7qxm", "K7QXM"],
    [" K7 QXM ", "K7QXM"],
    ["K0QXM", null],
    ["K7QX", null],
  ])("normalises %j to %s", (input, code) => {
    expect(normaliseRoomCode(input)).toBe(code);
  });
});
