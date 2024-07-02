import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity()
@Index(["transactionHash", "logIndex"], { unique: true })
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  eventName: string;

  @Column()
  eventSignature: string;

  @Column({ type: "text" })
  eventData: string;

  @Column()
  blockNumber: number;

  @Column()
  transactionHash: string;

  @Column()
  logIndex: number;

  @Column({ type: "text", nullable: true })
  parsedData: string;

  @Column()
  contractAddress: string;

  @Column()
  appName: string;
}
