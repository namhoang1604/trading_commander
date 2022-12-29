require('dotenv').config();
import * as fs from 'fs';
import * as byline from 'byline';
import * as streamBuffers from 'stream-buffers';
import * as path from 'path';
import { parse } from 'csv-parse';
import { DataSource } from 'typeorm';
import { from as copyFrom } from 'pg-copy-streams';
import { pipeline } from 'stream/promises';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';
import { calculatePortfolioForTransaction } from '../services/portfolio';
import { stringifyJson } from '../helper';

const csvHeaders = ['timestamp', 'transactionType', 'token', 'amount'];

type Transaction = {
  timestamp: number;
  transactionType: string;
  token: string;
  amount: number;
};

async function createPartitionTransactionsTable(
  connection: DataSource,
  maxTimestamp: number,
) {
  const queryRunner = connection.createQueryRunner();
  const pgConnection = await (<PostgresQueryRunner>queryRunner).connect();
  const maxYear = new Date(maxTimestamp * 1000).getFullYear();
  const minYear = new Date(0).getFullYear();
  for (let year = minYear; year <= maxYear; year++) {
    const partitionTable = `transactions_${year}`;
    const fromValue = Date.parse(`${year}-01-01`) / 1000;
    const toValue = Date.parse(`${year + 1}-01-01`) / 1000;
    await pgConnection.query(
      `CREATE TABLE IF NOT EXISTS ${partitionTable} PARTITION OF transactions FOR VALUES FROM (${fromValue}) TO (${toValue});`,
    );
  }
}

async function readAndPartitionByYear(connection: DataSource) {
  let maxTimestamp = 0;

  const filePath = path.resolve(
    __dirname,
    process.env.TRANSACTIONS_CSV as string,
  );

  maxTimestamp = await new Promise((resolve) => {
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(
        parse({
          delimiter: ',',
          columns: csvHeaders,
          fromLine: 2,
          toLine: 2,
        }),
      )
      .on('data', (row: Transaction) => {
        maxTimestamp =
          row.timestamp > maxTimestamp ? row.timestamp : maxTimestamp;
        resolve(maxTimestamp);
      });
  });
  await createPartitionTransactionsTable(connection, maxTimestamp);
}

async function reverseTransactions() {
  const csvFilePath = path.resolve(
    __dirname,
    process.env.TRANSACTIONS_CSV as string,
  );
  return await new Promise<any[]>(async (resolve) => {
    let bufferArray: any[] = [];
    bufferArray = await new Promise<any[]>((subResolve) => {
      const maxLine = 4000;
      let lineNum = 0;
      let bufferData = Buffer.from([]);
      let stream = fs.createReadStream(csvFilePath);
      byline
        .createStream(stream)
        .on('data', (line) => {
          bufferData = Buffer.concat([line, Buffer.from('\r\n'), bufferData]);
          lineNum++;
          if (lineNum === maxLine) {
            const t = bufferArray.unshift(bufferData);
            bufferData = Buffer.from([]);
            lineNum = 0;
          }
        })
        .on('end', () => {
          if (lineNum > 0) {
            const t = bufferArray.unshift(bufferData);
            bufferData = Buffer.from([]);
            lineNum = 0;
          }
          subResolve(bufferArray);
        });
    });

    const data = await Promise.all(
      bufferArray.map((buffer, index) => {
        const subReversedTransactions: any[] = [];
        return new Promise<any[]>((subResolve) => {
          parse(buffer, {
            delimiter: ',',
            columns: csvHeaders,
          })
            .on('data', (transaction) => {
              if (transaction.timestamp !== 'timestamp') {
                const t = subReversedTransactions.push(transaction);
              }
            })
            .on('end', () => {
              subResolve(subReversedTransactions);
            });
        });
      }),
    );
    resolve(data.flat());
  });
}

async function copyFromArrayToDB(connection: DataSource, data: Buffer) {
  const queryRunner = connection.createQueryRunner();
  const pgConnection = await (<PostgresQueryRunner>queryRunner).connect();
  const readableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
    chunkSize: 20480, // in bytes.
  });
  readableStreamBuffer.put(data);
  readableStreamBuffer.stop();

  await pipeline(
    readableStreamBuffer,
    pgConnection.query(
      copyFrom(
        `COPY transactions("timestamp", "transactionType", "token", "amount", "portfolio") FROM STDIN (FORMAT csv, HEADER true);`,
      ),
    ),
  );
}

function calculatePortfolios(tranactions: any[]) {
  let previousPortfolio: any = null;
  tranactions.forEach((tranaction) => {
    previousPortfolio = calculatePortfolioForTransaction(
      previousPortfolio,
      tranaction,
    );
  });
}

function arrayToCSV(transactions: any[]) {
  let csvHeaders = 'timestamp,transactionType,token,amount,portfolio\n';
  const listCsvChunk = [];
  const listCsvChunkForCopy = [];
  const number = transactions.length;
  const maxChunkLine = 7500;
  const quotient = Math.floor(number / maxChunkLine);
  const remainder = number % maxChunkLine;
  const totalChunk = remainder > 0 ? quotient + 1 : quotient;
  const maxLine = 3000000; // max line for once COPY
  const maxChunk = maxLine / 7500;
  const quotientForCopy = Math.floor(totalChunk / maxChunk);
  const remainderForCopy = totalChunk % maxChunk;

  for (let i = 0; i < quotient; i++) {
    let csv = '';
    for (let j = 0; j < 7500; j++) {
      const line = transactions.pop();
      const convertedLine = `${line.timestamp},${line.transactionType},${
        line.token
      },${line.amount}, ${stringifyJson(line.portfolio)}`;
      if (j === 0) {
        csv = convertedLine;
      } else {
        csv = csv + '\n' + convertedLine;
      }
    }
    listCsvChunk[i] = Buffer.from(csv);
  }

  let remainderCsv = '';
  for (let i = 0; i < remainder; i++) {
    const line = transactions.pop();
    const convertedLine = `${line.timestamp},${line.transactionType},${
      line.token
    },${line.amount}, ${stringifyJson(line.portfolio)}`;
    if (i === 0) {
      remainderCsv = convertedLine;
    } else {
      remainderCsv = remainderCsv + '\n' + convertedLine;
    }
  }

  if (remainderCsv !== '') {
    listCsvChunk.push(Buffer.from(remainderCsv));
  }

  for (let i = 0; i < quotientForCopy; i++) {
    const csvChunkForCopy = listCsvChunk.splice(0, maxChunk).map((d, idx) => {
      if (idx > 0) {
        return Buffer.concat([Buffer.from('\n'), d]);
      }
      return d;
    });
    csvChunkForCopy.unshift(Buffer.from(csvHeaders));
    listCsvChunkForCopy.push(Buffer.concat(csvChunkForCopy));
  }
  if (remainderForCopy > 0) {
    const csvChunkForCopy = listCsvChunk
      .splice(0, remainderForCopy)
      .map((d, idx) => {
        if (idx > 0) {
          return Buffer.concat([Buffer.from('\n'), d]);
        }
        return d;
      });
    csvChunkForCopy.unshift(Buffer.from(csvHeaders));
    listCsvChunkForCopy.push(Buffer.concat(csvChunkForCopy));
  }

  return listCsvChunkForCopy;
}

async function proceedData() {
  const data = await reverseTransactions();
  console.log('Reversing data done');
  calculatePortfolios(data);
  console.log('Calculating portfolio done');
  return arrayToCSV(data);
}

async function multiProceedCopy(connection: DataSource, data: Buffer[]) {
  const poolSize = 10;
  const executionQuotient = Math.floor(data.length / poolSize);
  const executionRemainder = data.length % poolSize;

  for (let i = 0; i < executionQuotient; i++) {
    const executionData = data.splice(0, poolSize);
    await Promise.all(
      executionData.map(async (d) => {
        await copyFromArrayToDB(connection, d);
      }),
    );
  }

  if (executionRemainder > 0) {
    const executionData = data.splice(0, executionRemainder);
    await Promise.all(
      executionData.map(async (d) => {
        await copyFromArrayToDB(connection, d);
      }),
    );
  }
}

async function seed(connection: DataSource) {
  await readAndPartitionByYear(connection);
  console.log('Partition done');
  const data = await proceedData();
  console.log('Buffer data done');
  await multiProceedCopy(connection, data);
  console.log('Copying data done');
}
export default seed;
