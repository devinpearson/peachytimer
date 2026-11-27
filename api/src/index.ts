import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env"), quiet: true });

import { startServer } from "./app";
import { loadConfig, logger } from "./utils/config";

async function main(): Promise<void> {
  const config = loadConfig();
  const running = await startServer(config);
  logger.info(`Peachy Timer API listening on port ${config.port}`);

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info(`Received ${signal}, shutting down`);
    running.stop().then(
      () => process.exit(0),
      (error) => {
        logger.error("Error during shutdown", { error });
        process.exit(1);
      },
    );
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("Failed to start", { error });
  process.exit(1);
});
