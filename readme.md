# EVM Event Tracker

## Overview

The EVM Event Tracker is an application designed to track and save specified smart contract events from an Ethereum-compatible blockchain. The events to be tracked can be specified in the environment configuration files (`.env.development` and `.env.production`), or if set to null, the application will track and save all events.

Key features include:

- Tracking of targeted smart contract events
- Configurable start block number
- Integration with PostgreSQL for storing events
- Integration with Redis for caching
- Comprehensive logging
- Docker setup including Metabase for BI (Business Intelligence)
- Automatic generation and storage of event signatures and their hashes, with values stored in `parsedData` field as JSONB object
- Rescan feature for backfilling missed events

## Example Contract

An example contract on Polygon, WETH, is used with its ABI located at `/src/abi/WETH.json`.

## Prerequisites

- Node.js
- Docker
- Docker Compose

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/yourusername/evm-event-tracker.git
   cd evm-event-tracker
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Create and configure environment files:
   * `.env.development`
   * `.env.production`

   Example `.env.development`:
   ```
   NODE_ENV=development
   APP_NAME=evm-event-tracker
   LOG_DIR=../logs
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=dev_user
   DB_PASSWORD=dev_password
   DB_NAME=event_tracker_dev
   REDIS_HOST=localhost
   REDIS_PORT=6379
   CONTRACT_ADDRESS=0x7ceb23fd6bc0add59e62ac25578270cff1b9f619
   CONTRACT_ABI_PATH=./src/abi/WETH.json
   CONTRACT_EVENT_NAMES=Approval,Transfer
   RPC_URL=https://polygon-mainnet.infura.io/v3/INFURA_ID_OR_ANY_PUBLIC_RPC
   POLL_INTERVAL_MS=60000
   STARTING_BLOCK_NUMBER=58799213
   RESCAN=true
   RESCAN_TIMER=600000
   ```

## Running the Application

1. Start the required services using Docker Compose:
   ```sh
   docker-compose --env-file=.env.development up -d
   ```

2. Run the application:
   ```sh
   npm start
   ```

## Command-Line Arguments

The application accepts command-line arguments to override existing configuration settings. This allows for multiple instances of the app with different purposes or targeted contracts.

- `--appname <appname>`: Application name
- `--rpc <url>`: RPC URL
- `--abi <path>`: ABI path
- `--events <names>`: Event names, comma separated
- `--block <number>`: Starting block number
- `--contract <address>`: Contract address
- `--rescan <rescan>`: Enable rescan feature (true/false)

Example:
```sh
npm start -- --block=6000000 --contract=0x1234567890abcdef --events=Transfer,Approval
```

## Conditions

When you stop the application and restart with a new block number, the application will check if they are compatible with the saved data.

ReScan time interval, always should be greater than poll interval. Close numbers can get have a performance problems. 

## Rescan Feature

The `--rescan` feature is designed to handle cases where the application might miss some events. When enabled, a separate thread in the app will backfill events at a given interval (currently set to 10 minutes). This ensures that any events that might have been missed during the initial scan or due to temporary issues are eventually captured and stored.

While the rescan process runs periodically, the main application continues to add events in real-time, ensuring comprehensive event tracking.

## Docker Setup

The `docker-compose.yml` includes the following services:
- `postgres`: PostgreSQL database
- `redis`: Redis for caching
- `metabase`: Metabase for business intelligence

## Accessing Metabase

1. Open your browser and go to `http://localhost:3000`.
2. Complete the registration process.
3. When adding a new database in Metabase, use the following settings:
   - **Database type**: PostgreSQL
   - **Host**: postgres
   - **Port**: 5432
   - **Database name**: `event_tracker_dev` (or the name specified in your `.env` file)
   - **Username**: `dev_user` (or the username specified in your `.env` file)
   - **Password**: `dev_password` (or the password specified in your `.env` file)

## Stopping the Application

To stop the application and its services:

1. Stop the Node.js application:
   ```sh
   npm stop
   ```

2. Stop and remove the Docker containers:
   ```sh
   docker-compose down
   ```

## Contributing

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin feature-branch`).
5. Create a new Pull Request.