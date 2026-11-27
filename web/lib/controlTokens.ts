/**
 * Control tokens let a browser run a room's timer. The room creator gets one; sharing the
 * control link (with the token in the URL fragment, which never reaches a server) hands
 * control to another device. Tokens are remembered per room in localStorage.
 */
const KEY_PREFIX = "peachytimer:control:";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function rememberToken(code: string, token: string, store: StorageLike | null = storage()): void {
  try {
    store?.setItem(KEY_PREFIX + code.toUpperCase(), token);
  } catch {
    // Private mode or storage full: the token still works for this page via the URL fragment.
  }
}

export function recallToken(code: string, store: StorageLike | null = storage()): string | null {
  try {
    return store?.getItem(KEY_PREFIX + code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

/** Reads `token=...` from a URL fragment such as "#token=abc". */
export function tokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("token");
}

export function controlLink(origin: string, code: string, token: string): string {
  return `${origin}/room/${code}/control#token=${encodeURIComponent(token)}`;
}

export function displayLink(origin: string, code: string): string {
  return `${origin}/room/${code}`;
}

/** Room codes are 5 characters from an alphabet without look-alikes (no 0/O, 1/I/L). */
export function normaliseRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-HJKMNP-Z2-9]{5}$/.test(code) ? code : null;
}
