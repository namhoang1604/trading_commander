import { BaseSchema } from './base-schema';
export declare class TransactionEntity extends BaseSchema {
    timestamp: number;
    transactionType: string;
    token: string;
    amount: number;
    portfolio: object;
}
