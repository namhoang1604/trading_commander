import { DataSource } from 'typeorm';
import { TransactionEntity } from '../entities/transaction.entity';
export declare function calculatePortfolioForTransaction(previousTransaction: any, transaction: any): any;
type PortfolioParams = {
    date: number;
};
export declare function getPortfolios(connection: DataSource, params: PortfolioParams): Promise<TransactionEntity[]>;
export {};
