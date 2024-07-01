import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import winston, { format } from 'winston';
import winstonDaily from 'winston-daily-rotate-file';
import { SyslogTransportOptions } from 'winston-syslog';
import { config } from '../config/config';

const { combine, timestamp, printf, colorize, splat } = format;
const { logDir, nodeEnv, appName, logServer } = config;

const logDirectory: string = join(__dirname, logDir);
if (!existsSync(logDirectory)) {
  mkdirSync(logDirectory);
}

const logFormat = printf(({ timestamp, level, message, stack }) => {
  return `${timestamp} ${level}: ${message} ${stack ? `at line ${stack.split("\n")[1]}` : ""}`;
});

const opt: SyslogTransportOptions = {
  host: logServer,
  port: 514,
  protocol: 'tcp4',
  facility: 'local0',
  app_name: appName,
  eol: '\n',
};

const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winstonDaily({
      level: 'debug',
      datePattern: 'YYYY-MM-DD',
      dirname: `${logDirectory}/debug`,
      filename: `%DATE%.log`,
      maxFiles: 30,
      json: false,
      zippedArchive: true,
    }),
    new winstonDaily({
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      dirname: `${logDirectory}/error`,
      filename: `%DATE%.log`,
      maxFiles: 30,
      handleExceptions: true,
      json: false,
      zippedArchive: true,
    }),
    //new Syslog(opt),
  ],
  exceptionHandlers: [
    new winstonDaily({
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      dirname: `${logDirectory}/exceptions`,
      filename: `%DATE%.log`,
      maxFiles: 30,
      json: false,
      zippedArchive: true,
    }),
    //new Syslog(opt),
  ],
});

if (nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(splat(), colorize())
    })
  );
}

const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

process.on('unhandledRejection', (reason, promise) => {
  if (reason instanceof Error) {
    logger.error('Unhandled Rejection at:', {
      message: reason.message,
      stack: reason.stack,
      promise,
    });
  } else {
    logger.error('Unhandled Rejection at:', {
      reason,
      promise,
    });
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown', {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

export { logger, stream };

