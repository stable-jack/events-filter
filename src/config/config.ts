import { Command } from "commander";
import dotenv from "dotenv";
import path from "path";
import { Config } from "src/interfaces";

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const program = new Command();
const genesis = "0";

program
  .option("--appname <appname>", "Application name")
  .option("--rpc <url>", "RPC URL")
  .option("--abi <path>", "ABI path")
  .option("--events <names>", "Event names, comma separated")
  .option("--block <number>", "Starting block number", (value) =>
    parseInt(value, 10),
  )
  .option("--contract <address>", "Contract address")
  .option(
    "--rescan <rescan>",
    "Enable rescan feature",
    (value) => value === "true",
  );

program.parse(process.argv);
const options = program.opts();

const eventNames: string[] = options.events
  ? options.events.split(",").map((event: string) => event.trim())
  : process.env.CONTRACT_EVENT_NAMES
    ? process.env.CONTRACT_EVENT_NAMES.split(",").map((event: string) =>
        event.trim(),
      )
    : [];

const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || "60000", 10);
const rescanTimer = parseInt(process.env.RESCAN_TIMER || "600000", 10);

if (rescanTimer <= pollIntervalMs) {
  console.error("RESCAN_TIMER must be greater than POLL_INTERVAL_MS");
  process.exit(1);
}

export const config: Config = {
  nodeEnv: process.env.NODE_ENV || "development",
  appName: options.appname || process.env.APP_NAME || "event-tracker",
  logDir: process.env.LOG_DIR || "logs",
  logServer: process.env.LOG_SERVER,
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "password",
    name: process.env.DB_NAME || "evm-event-tracker",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },
  contract: {
    address: options.contract || process.env.CONTRACT_ADDRESS,
    rpcUrl: options.rpc || process.env.RPC_URL,
    abiPath: options.abi || process.env.CONTRACT_ABI_PATH || "",
    eventNames: eventNames,
  },
  pollIntervalMs: pollIntervalMs,
  rescan: options.rescan,
  rescanTimer: rescanTimer,
  startBlockNumber:
    options.block || parseInt(process.env.STARTING_BLOCK_NUMBER || genesis, 10),
};

console.log(`Running with config: ${JSON.stringify(config, null, 2)}`);
