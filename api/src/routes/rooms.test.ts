import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../app";
import { RoomStore } from "../domain/roomStore";

const setup = () => {
  const store = new RoomStore(60_000);
  return { store, app: createApp(store, { corsOrigins: ["http://localhost:3000"] }) };
};

describe("rooms API", () => {
  it("reports health", async () => {
    const { app } = setup();
    await request(app).get("/api/health/live").expect(200, { status: "ok" });
    const ready = await request(app).get("/api/health/ready").expect(200);
    expect(ready.body).toEqual({ status: "ok", rooms: 0 });
  });

  it("lists presets", async () => {
    const res = await request(setup().app).get("/api/presets").expect(200);
    expect(res.body.presets.map((p: { id: string }) => p.id)).toContain("table-topics");
  });

  it("creates a room and fetches it without exposing the token", async () => {
    const { app } = setup();
    const created = await request(app).post("/api/rooms").send({ presetId: "evaluation" }).expect(201);
    expect(created.body.controlToken).toEqual(expect.any(String));
    expect(created.body.room.presetId).toBe("evaluation");

    const fetched = await request(app).get(`/api/rooms/${created.body.room.code}`).expect(200);
    expect(fetched.body.room.code).toBe(created.body.room.code);
    expect(JSON.stringify(fetched.body)).not.toContain(created.body.controlToken);
    expect(fetched.body.serverTime).toEqual(expect.any(Number));
  });

  it("creates a room with no body", async () => {
    const res = await request(setup().app).post("/api/rooms").expect(201);
    expect(res.body.room.presetId).toBe("speech");
  });

  it("rejects unknown presets and bad bodies", async () => {
    const { app } = setup();
    await request(app).post("/api/rooms").send({ presetId: "nope" }).expect(400);
    await request(app).post("/api/rooms").send({ presetId: 5 }).expect(400);
    await request(app)
      .post("/api/rooms")
      .set("content-type", "application/json")
      .send("{not json")
      .expect(400, { error: "Malformed JSON" });
  });

  it("404s unknown rooms and routes", async () => {
    const { app } = setup();
    await request(app).get("/api/rooms/NOPE1").expect(404);
    await request(app).post("/api/rooms/NOPE1/commands").send({ type: "start" }).expect(404);
    await request(app).get("/api/elsewhere").expect(404);
  });

  it("applies commands only with the control token", async () => {
    const { app } = setup();
    const created = await request(app).post("/api/rooms").expect(201);
    const { code } = created.body.room;
    const url = `/api/rooms/${code}/commands`;

    await request(app).post(url).send({ type: "start" }).expect(403);
    await request(app).post(url).set("authorization", "Bearer wrong").send({ type: "start" }).expect(403);

    const auth = `Bearer ${created.body.controlToken}`;
    const started = await request(app).post(url).set("authorization", auth).send({ type: "start" }).expect(200);
    expect(started.body.room.status).toBe("running");

    await request(app).post(url).set("authorization", auth).send({ type: "fly" }).expect(400);
    await request(app)
      .post(url)
      .set("authorization", auth)
      .send({ type: "set-preset", presetId: "nope" })
      .expect(400);
  });
});
