require('dotenv').config();
import { TransactionEntity } from '../entities/transaction.entity';

const dbHost = process.env.DATABASE_HOST as string;
const dbPort = +(process.env.DATABASE_PORT as string);
const dbUsername = process.env.DATABASE_USERNAME as string;
const dbPassword = process.env.DATABASE_PASSWORD as string;
const dbPoolSize = +(process.env.DATABASE_POOL_SIZE as string);
const dbName = process.env.DATABASE_NAME as string;

export const dataSource = {
  host: dbHost,
  port: dbPort,
  username: dbUsername,
  password: dbPassword,
  database: dbName,
  poolSize: dbPoolSize,
  type: 'postgres',
  entities: [TransactionEntity],
  synchronize: false,
  logging: false,
  migrations: [__dirname + '/migrations/*.ts'],
};

export default {
  ...dataSource,
  cli: {
    migrationsDir: 'src/database/migrations',
  },
};
