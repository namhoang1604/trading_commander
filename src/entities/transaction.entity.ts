import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseSchema } from './base-schema';

@Entity({ name: 'transactions' })
@Index(['timestamp', 'transactionType', 'token', 'amount'], { unique: true })
export class TransactionEntity extends BaseSchema {
  @Index()
  @Column()
  timestamp!: number;

  @Index()
  @Column()
  transactionType!: string;

  @Index()
  @Column()
  token!: string;

  @Column('double precision')
  amount!: number;

  @Column('jsonb', { default: {} })
  portfolio!: object;
}
