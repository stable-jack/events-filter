export interface Config {
    nodeEnv: string;
    appName: string;
    logDir: string;
    logServer?: string;
    database: {
      host: string;
      port: number;
      username: string;
      password: string;
      name: string;
    };
    redis: {
      host: string;
      port: number;
    };
    contract: {
      address?: string;
      rpcUrl?: string;
      abiPath: string;
      eventNames: string[];
    };
    pollIntervalMs: number;
    rescan: boolean;
    rescanTimer: number;
    startBlockNumber: number;
  }
  