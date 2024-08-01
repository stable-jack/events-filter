import Redis from "redis";
import { DataSource } from "typeorm";
import { promisify } from "util";
import { config } from "./config/config";
import { Event } from "./entities/Event";
import { logger } from "./logger/logger";
import { EventTracker } from "./services/EventTracker";

async function getLatestBlockFromDb(dataSource: DataSource): Promise<number> {
  const latestBlock = await dataSource.query(
    `SELECT MAX("blockNumber") AS "latestBlock" FROM event WHERE "appName" = '${config.appName}'`,
  );
  return latestBlock[0].latestBlock || config.startBlockNumber;
}

async function main() {
  const dataSource = new DataSource({
    type: "postgres",
    host: config.database.host,
    port: config.database.port,
    username: config.database.username,
    password: config.database.password,
    database: config.database.name,
    entities: [Event],
    synchronize: true,
  });

  await dataSource.initialize();
  logger.debug("Database connection established");

  const redisClient = Redis.createClient({
    host: config.redis.host,
    port: config.redis.port,
  });

  await promisify(redisClient.get).bind(redisClient);
  const currentBlock = await getLatestBlockFromDb(dataSource);

  if (config.startBlockNumber > currentBlock) {
    console.error(
      `Configured start block number ${config.startBlockNumber} is bigger than the latest processed block ${currentBlock}. Aborting.`,
    );
    process.exit(1);
  } else {
    config.startBlockNumber = currentBlock;
  }

  console.log("Hawk Tuah", config.startBlockNumber);
  return;

  const eventTracker = new EventTracker(dataSource, config.pollIntervalMs);
  await eventTracker.initialize();
  logger.debug("Event tracker initialized");

  // graceful shutdown
  process.on("SIGINT", async () => {
    logger.debug("Stopping event tracker...");
    eventTracker.stop();
    await dataSource.destroy();
    redisClient.quit();
    logger.debug("Database connection closed");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
