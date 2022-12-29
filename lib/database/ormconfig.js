"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataSource = void 0;
require('dotenv').config();
const transaction_entity_1 = require("../entities/transaction.entity");
const dbHost = process.env.DATABASE_HOST;
const dbPort = +process.env.DATABASE_PORT;
const dbUsername = process.env.DATABASE_USERNAME;
const dbPassword = process.env.DATABASE_PASSWORD;
const dbPoolSize = +process.env.DATABASE_POOL_SIZE;
const dbName = process.env.DATABASE_NAME;
exports.dataSource = {
    host: dbHost,
    port: dbPort,
    username: dbUsername,
    password: dbPassword,
    database: dbName,
    poolSize: dbPoolSize,
    type: 'postgres',
    entities: [transaction_entity_1.TransactionEntity],
    synchronize: false,
    logging: false,
    migrations: [__dirname + '/migrations/*.ts'],
};
exports.default = Object.assign(Object.assign({}, exports.dataSource), { cli: {
        migrationsDir: 'src/database/migrations',
    } });
