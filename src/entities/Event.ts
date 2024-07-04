import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity()
@Index(["transactionHash", "logIndex"], { unique: true })
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  eventName: string;

  @Column()
  eventSignature: string;

  @Column()
  eventSignatureHash: string;

  @Column({ type: "text" })
  eventData: string;

  @Column()
  blockNumber: number;

  @Column()
  transactionHash: string;

  @Column()
  logIndex: number;

  @Column({ type: "jsonb", nullable: true })
  parsedData: string;

  @Column()
  sender: string;

  @Column()
  receiver: string;

  @Column()
  amountTransferred: string;

  @Column()
  contractAddress: string;

  @Column()
  appName: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;
}
