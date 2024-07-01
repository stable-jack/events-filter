import { ethers } from 'ethers';
import fs from 'fs';
import { config } from '../config/config';
import { logger } from '../logger/logger';

export interface EventDefinition {
  name: string;
  signature: string;
}

interface AbiInput {
  internalType: string;
  name: string;
  type: string;
}

interface AbiEvent {
  anonymous: boolean;
  inputs: AbiInput[];
  name: string;
  type: string;
}

const abiPath = config.contract.abiPath;
const abiContent = fs.readFileSync(abiPath, 'utf8');
const abiJson = JSON.parse(abiContent);
const abi: AbiEvent[] = JSON.parse(abiJson.result); 

const extractEventsFromAbi = (abi: AbiEvent[]): EventDefinition[] => {
  return abi
    .filter(item => item.type === 'event')
    .map(event => ({
      name: event.name,
      signature: `${event.name}(${event.inputs.map((input: AbiInput) => input.type).join(',')})`,
    }));
};

export const allContractEvents: EventDefinition[] = extractEventsFromAbi(abi);

export function generateEventSignatures(events: EventDefinition[]): string[] {
  return events.map(event => ethers.keccak256(ethers.toUtf8Bytes(event.signature)));
}

const wantedEventNames = new Set([...config.contract.eventNames]);
const filteredEvents = allContractEvents.filter(event => wantedEventNames.has(event.name));

wantedEventNames.forEach(eventName => {
  if (!filteredEvents.some(event => event.name === eventName)) {
    logger.error(`Warning: Event name "${eventName}" not found in the ABI.`);
    process.exit(1);
  }
});

export const contractEvents = filteredEvents;

export const eventSignatures = generateEventSignatures(contractEvents);

logger.info(`Filtered contract events: ${JSON.stringify(contractEvents)}`);
logger.info(`Event signatures: ${JSON.stringify(eventSignatures)}`);



