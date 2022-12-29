import { TransactionEntity } from '../entities/transaction.entity';
export declare const dataSource: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    poolSize: number;
    type: string;
    entities: (typeof TransactionEntity)[];
    synchronize: boolean;
    logging: boolean;
    migrations: string[];
};
declare const _default: {
    cli: {
        migrationsDir: string;
    };
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    poolSize: number;
    type: string;
    entities: (typeof TransactionEntity)[];
    synchronize: boolean;
    logging: boolean;
    migrations: string[];
};
export default _default;
