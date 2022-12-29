"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDB1672043422438 = void 0;
require('dotenv').config();
class CreateDB1672043422438 {
    async up(queryRunner) {
        const dbName = process.env.DATABASE_NAME;
        await queryRunner.createDatabase(dbName, true);
        await queryRunner.query(`
    create table if not exists "transactions" (
      "id" SERIAL not null,
      "createdDate" TIMESTAMP not null default now(),
      "updatedDate" TIMESTAMP not null default now(),
      "timestamp" integer not null,
      "transactionType" character varying not null,
      "token" character varying not null,
      "amount" double precision not null,
      "portfolio" jsonb not null default '{}',
      constraint "PK_a219afd8dd77ed80f5a862f1db9" primary key ("id", "timestamp"))
    partition by range("timestamp");
    `);
        await queryRunner.query(`
    create index if not exists "IDX_4c1bd13826400c29b01b90d523" on
      "transactions" ("timestamp"); 
    create index if not exists "IDX_8a6ba6c3d87545dec623f6dfb4" on
      "transactions" ("transactionType"); 
    create index if not exists "IDX_d01658e8fde1da61321f23a21d" on
      "transactions" ("token"); 
    create unique index if not exists "IDX_454f4285d2f91913d8c49edfbb" on
      "transactions" ("timestamp",
      "transactionType",
      "token",
      "amount");
    `);
    }
    async down(queryRunner) { }
}
exports.CreateDB1672043422438 = CreateDB1672043422438;
