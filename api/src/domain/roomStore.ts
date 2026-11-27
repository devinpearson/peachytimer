import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { type Command, type RoomState, applyCommand, createRoomState } from "./timer";

/** No 0/O, 1/I/L, so a code read off a projector is hard to mistype. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

interface StoredRoom {
  state: RoomState;
  controlToken: string;
}

interface CreatedRoom {
  room: RoomState;
  controlToken: string;
}

type Clock = () => number;

/**
 * Rooms live in memory: a timing session lasts one meeting, so nothing needs to
 * survive a restart. Emits "change" with the new RoomState after every command.
 */
export class RoomStore extends EventEmitter {
  private rooms = new Map<string, StoredRoom>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: Clock = Date.now,
  ) {
    super();
  }

  create(presetId?: string): CreatedRoom {
    const code = this.newCode();
    const room = createRoomState(code, this.now(), presetId);
    const controlToken = randomBytes(24).toString("base64url");
    this.rooms.set(code, { state: room, controlToken });
    return { room, controlToken };
  }

  get(code: string): RoomState | undefined {
    return this.rooms.get(normaliseCode(code))?.state;
  }

  canControl(code: string, token: string): boolean {
    const stored = this.rooms.get(normaliseCode(code));
    if (!stored) return false;
    const expected = Buffer.from(stored.controlToken);
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  /** Throws CommandError for an invalid command; returns undefined if the room doesn't exist. */
  apply(code: string, command: Command): RoomState | undefined {
    const stored = this.rooms.get(normaliseCode(code));
    if (!stored) return undefined;
    const next = applyCommand(stored.state, command, this.now());
    if (next !== stored.state) {
      stored.state = next;
      this.emit("change", next);
    }
    return next;
  }

  /** Removes rooms nobody has touched within the TTL. Returns the codes removed. */
  sweep(): string[] {
    const cutoff = this.now() - this.ttlMs;
    const removed: string[] = [];
    for (const [code, stored] of this.rooms) {
      if (stored.state.updatedAt < cutoff && stored.state.status !== "running") {
        this.rooms.delete(code);
        removed.push(code);
      }
    }
    for (const code of removed) this.emit("removed", code);
    return removed;
  }

  get size(): number {
    return this.rooms.size;
  }

  private newCode(): string {
    for (;;) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}
