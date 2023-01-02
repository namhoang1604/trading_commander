#!/usr/bin/env node

import chalk from 'chalk';
import clear from 'clear';
import figlet from 'figlet';
import { createCommand, Option, InvalidArgumentError } from 'commander';
import seed from './database/seed';
import DBConnection from './database/config';
import { DataSource } from 'typeorm';
import { getPortfolios } from './services/portfolio';
import { TransactionEntity } from './entities/transaction.entity';

function parseDate(value: string) {
  const parsedValue = Date.parse(value);
  if (isNaN(parsedValue)) {
    throw new InvalidArgumentError(
      'Not a date, please input with format YYYY-MM-DD.',
    );
  }
  return parsedValue / 1000; // Convert to seconds
}

async function connectDB(): Promise<DataSource> {
  return DBConnection.initialize();
}

function viewPortfolio(tranactions: TransactionEntity[], filterToken?: string) {
  return tranactions.map((t) => {
    const portfolio = Object.entries({ ...t.portfolio })
      .filter(([k, v]) => {
        if (filterToken) {
          return k.includes(`${filterToken}_USD`);
        } else {
          return k.includes('USD');
        }
      })
      .reduce((acc: any, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {});

    return { timestamp: new Date(t.timestamp * 1000), ...portfolio };
  });
}

const program = createCommand();

clear();
console.log(
  chalk.white(figlet.textSync('trading-cli', { horizontalLayout: 'full' })),
);

program
  .version('0.0.1')
  .name('trading')
  .description('A CLI for retrieve the portfolio value');

program
  .command('setup')
  .description('Setup data')
  .action(async () => {
    const connection = await connectDB();
    await seed(connection);
    process.exit(0);
  });

program
  .command('retrieve')
  .description('Fetch portfolio')
  .addOption(
    new Option('-t, --token <token>', 'base on token').argParser((t) =>
      t.toUpperCase(),
    ),
  )
  .addOption(
    new Option('-d, --date <date>', 'base on date').argParser(parseDate),
  )
  .action(async (args) => {
    const connection = await connectDB();
    const transactions = await getPortfolios(connection, {
      date: args.date,
    });
    console.table(viewPortfolio(transactions, args.token));
    process.exit(0);
  });

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

(async function () {
  await program.parseAsync(process.argv);
})();
