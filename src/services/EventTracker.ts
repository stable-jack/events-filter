import { ethers, Log } from "ethers";
import fs from "fs";
import Redis from "redis";
import { DataSource, Repository } from "typeorm";
import { promisify } from "util";
import { config } from "../config/config";
import { Event } from "../entities/Event";
import { eventSignatures } from "../events/contractEvents";
import { logger } from "../logger/logger";

export class EventTracker {
  private provider: ethers.JsonRpcProvider;
  private eventRepository: Repository<Event>;
  private latestProcessedBlock: number;
  private pollingInterval: NodeJS.Timeout | null = null;
  private rescanInterval: NodeJS.Timeout | null = null;
  private redisClient: Redis.RedisClient;
  private redisGetAsync: (key: string) => Promise<string | null>;
  private redisSetAsync: (key: string, value: string) => Promise<unknown>;
  private iface: ethers.Interface;
  private filter: ethers.Filter;

  constructor(
    private dataSource: DataSource,
    private pollIntervalMs: number = 60000,
    private rescanIntervalMs: number = 600000,
  ) {
    this.provider = new ethers.JsonRpcProvider(config.contract.rpcUrl);
    this.eventRepository = this.dataSource.getRepository(Event);
    this.latestProcessedBlock = config.startBlockNumber || 0;

    this.redisClient = Redis.createClient({
      host: config.redis.host,
      port: config.redis.port,
    });
    this.redisGetAsync = promisify(this.redisClient.get).bind(this.redisClient);
    this.redisSetAsync = promisify(this.redisClient.set).bind(this.redisClient);

    const abiContent = fs.readFileSync(config.contract.abiPath, "utf8");
    const abiJson = JSON.parse(abiContent);
    const abi = JSON.parse(abiJson.result);
    this.iface = new ethers.Interface(abi);

    this.filter = {
      address: config.contract.address,
      topics: eventSignatures.length > 0 ? [eventSignatures] : [null],
    };
  }

  async initialize() {
    console.log("Initializing EventTracker...");
    const cachedBlock = await this.redisGetAsync("latestProcessedBlock");
    if (cachedBlock) {
      this.latestProcessedBlock = Math.max(
        parseInt(cachedBlock, 10),
        config.startBlockNumber,
      );
      console.log(`Resuming from cached block: ${this.latestProcessedBlock}`);
    } else {
      console.log(`Starting from block: ${this.latestProcessedBlock}`);
    }

    await this.collectPastEvents();
    this.startListening();
    this.startPolling();
    config.rescan ? this.startRescanning() : null;
    console.log("EventTracker initialized successfully.");
  }

  private async updateLatestProcessedBlock(blockNumber: number) {
    this.latestProcessedBlock = blockNumber;
    await this.redisSetAsync("latestProcessedBlock", blockNumber.toString());
    logger.info(`Updated latest processed block to: ${blockNumber}`);
  }

  private async collectPastEvents() {
    console.log("Collecting past events...");
    const latestBlock = await this.provider.getBlockNumber();
    const batchSize = 1000;

    for (
      let fromBlock = this.latestProcessedBlock;
      fromBlock <= latestBlock;
      fromBlock += batchSize
    ) {
      const toBlock = Math.min(fromBlock + batchSize - 1, latestBlock);
      console.log(`Processing blocks ${fromBlock} to ${toBlock}`);
      await this.processBlockRange(fromBlock, toBlock);
    }

    await this.updateLatestProcessedBlock(latestBlock);
    console.log("Finished collecting past events.");
  }

  private startListening() {
    console.log("Starting to listen for new events...");
    this.provider.on("block", async (blockNumber) => {
      console.log(`New block detected: ${blockNumber}`);
      if (blockNumber > this.latestProcessedBlock) {
        await this.processBlockRange(
          this.latestProcessedBlock + 1,
          blockNumber,
        );
        await this.updateLatestProcessedBlock(blockNumber);
      }
    });
  }

  private startPolling() {
    console.log(`Starting polling interval (${this.pollIntervalMs}ms)`);
    this.pollingInterval = setInterval(async () => {
      try {
        const latestBlock = await this.provider.getBlockNumber();
        if (latestBlock > this.latestProcessedBlock) {
          console.log(
            `Polling: Processing blocks ${this.latestProcessedBlock + 1} to ${latestBlock}`,
          );
          await this.processBlockRange(
            this.latestProcessedBlock + 1,
            latestBlock,
          );
          await this.updateLatestProcessedBlock(latestBlock);
        }
      } catch (error) {
        logger.error("Error during polling:", error);
      }
    }, this.pollIntervalMs);
  }

  private startRescanning() {
    console.log(`Starting rescan interval (${this.rescanIntervalMs}ms)`);
    this.rescanInterval = setInterval(async () => {
      try {
        // const latestBlock = await this.provider.getBlockNumber();
        const rescanBlockRange = 100;
        const fromBlock = Math.max(
          this.latestProcessedBlock - rescanBlockRange,
          0,
        );
        console.log(
          `Rescanning: Processing blocks ${fromBlock} to ${this.latestProcessedBlock}`,
        );
        await this.processBlockRange(fromBlock, this.latestProcessedBlock);
      } catch (error) {
        logger.error("Error during rescanning:", error);
      }
    }, this.rescanIntervalMs);
  }

  private async processBlockRange(fromBlock: number, toBlock: number) {
    const filter = { ...this.filter, fromBlock, toBlock };
    const logs = await this.provider.getLogs(filter);
    console.log(
      `Found ${logs.length} events in block range ${fromBlock}-${toBlock}`,
    );

    for (const log of logs) {
      await this.processEvent(log);
    }
  }

  private async processEvent(log: Log) {
    const existingEvent = await this.eventRepository.findOne({
      where: { transactionHash: log.transactionHash, logIndex: log.index },
    });

    if (!existingEvent) {
      let parsedLog;
      try {
        parsedLog = this.iface.parseLog({
          topics: Array.from(log.topics),
          data: log.data,
        });
      } catch (error) {
        logger.error("Error parsing log:", error);
      }

      const newEvent = new Event();
      if (parsedLog) {
        newEvent.eventName = parsedLog.name;
        newEvent.parsedData = JSON.stringify(parsedLog.args, (key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        );
      } else {
        newEvent.eventName = "UnknownEvent";
      }
      newEvent.eventSignature = log.topics[0];
      newEvent.eventData = log.data;
      newEvent.blockNumber = log.blockNumber;
      newEvent.transactionHash = log.transactionHash;
      newEvent.logIndex = log.index;
      newEvent.appName = config.appName;
      newEvent.contractAddress = config.contract.address || "";

      try {
        await this.eventRepository.save(newEvent);
        console.log(
          `Processed new event: ${newEvent.eventName} (Block: ${newEvent.blockNumber}, Tx: ${newEvent.transactionHash})`,
        );
      } catch (error) {
        if (error.code === "23505") {
          console.log(
            `Duplicate event detected: ${newEvent.transactionHash} - ${newEvent.logIndex}`,
          );
        } else {
          throw error;
        }
      }
    }
  }

  stop() {
    logger.debug("Stopping EventTracker...");
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    if (this.rescanInterval) {
      clearInterval(this.rescanInterval);
    }
    this.provider.removeAllListeners();
    this.redisClient.quit();
    logger.debug("EventTracker stopped.");
  }
}
