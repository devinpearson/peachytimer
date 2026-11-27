import winston from "winston";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  ROOM_TTL_HOURS: z.coerce.number().positive().default(12),
});

export interface Config {
  port: number;
  logLevel: string;
  corsOrigins: string[];
  roomTtlMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.parse(env);
  return {
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    corsOrigins: parsed.CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    roomTtlMs: parsed.ROOM_TTL_HOURS * 60 * 60 * 1000,
  };
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  silent: process.env.NODE_ENV === "test",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});
