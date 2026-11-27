import { type Request, type Response, Router } from "express";
import { z } from "zod";
import type { RoomStore } from "../domain/roomStore";
import { CommandError, PRESETS, commandSchema } from "../domain/timer";

const createRoomSchema = z.object({ presetId: z.string().optional() }).default({});

function bearerToken(req: Request): string | undefined {
  const header = req.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function notFound(res: Response): void {
  res.status(404).json({ error: "Room not found" });
}

export function createRoomsRouter(store: RoomStore): Router {
  const router = Router();

  router.get("/presets", (_req, res) => {
    res.json({ presets: PRESETS });
  });

  router.post("/rooms", (req, res) => {
    const body = createRoomSchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid request", issues: body.error.issues });
      return;
    }
    try {
      const { room, controlToken } = store.create(body.data.presetId);
      res.status(201).json({ room, controlToken, serverTime: Date.now() });
    } catch (error) {
      if (error instanceof CommandError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  router.get("/rooms/:code", (req, res) => {
    const room = store.get(req.params.code);
    if (!room) return notFound(res);
    res.json({ room, serverTime: Date.now() });
  });

  router.post("/rooms/:code/commands", (req, res) => {
    const { code } = req.params;
    if (!store.get(code)) return notFound(res);

    const token = bearerToken(req);
    if (!token || !store.canControl(code, token)) {
      res.status(403).json({ error: "This link can't control the timer" });
      return;
    }

    const command = commandSchema.safeParse(req.body);
    if (!command.success) {
      res.status(400).json({ error: "Invalid command", issues: command.error.issues });
      return;
    }

    try {
      const room = store.apply(code, command.data);
      res.json({ room, serverTime: Date.now() });
    } catch (error) {
      if (error instanceof CommandError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  return router;
}
