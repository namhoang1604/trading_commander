"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const fs = __importStar(require("fs"));
const byline = __importStar(require("byline"));
const streamBuffers = __importStar(require("stream-buffers"));
const path = __importStar(require("path"));
const csv_parse_1 = require("csv-parse");
const pg_copy_streams_1 = require("pg-copy-streams");
const promises_1 = require("stream/promises");
const portfolio_1 = require("../services/portfolio");
const helper_1 = require("../helper");
const csvHeaders = ['timestamp', 'transactionType', 'token', 'amount'];
async function createPartitionTransactionsTable(connection, maxTimestamp) {
    const queryRunner = connection.createQueryRunner();
    const pgConnection = await queryRunner.connect();
    const maxYear = new Date(maxTimestamp * 1000).getFullYear();
    const minYear = new Date(0).getFullYear();
    for (let year = minYear; year <= maxYear; year++) {
        const partitionTable = `transactions_${year}`;
        const fromValue = Date.parse(`${year}-01-01`) / 1000;
        const toValue = Date.parse(`${year + 1}-01-01`) / 1000;
        await pgConnection.query(`CREATE TABLE IF NOT EXISTS ${partitionTable} PARTITION OF transactions FOR VALUES FROM (${fromValue}) TO (${toValue});`);
    }
}
async function readAndPartitionByYear(connection) {
    let maxTimestamp = 0;
    const filePath = path.resolve(__dirname, process.env.TRANSACTIONS_CSV);
    maxTimestamp = await new Promise((resolve) => {
        fs.createReadStream(filePath, { encoding: 'utf-8' })
            .pipe((0, csv_parse_1.parse)({
            delimiter: ',',
            columns: csvHeaders,
            fromLine: 2,
            toLine: 2,
        }))
            .on('data', (row) => {
            maxTimestamp =
                row.timestamp > maxTimestamp ? row.timestamp : maxTimestamp;
            resolve(maxTimestamp);
        });
    });
    await createPartitionTransactionsTable(connection, maxTimestamp);
}
async function reverseTransactions() {
    const csvFilePath = path.resolve(__dirname, process.env.TRANSACTIONS_CSV);
    return await new Promise(async (resolve) => {
        let bufferArray = [];
        bufferArray = await new Promise((subResolve) => {
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
        const data = await Promise.all(bufferArray.map((buffer, index) => {
            const subReversedTransactions = [];
            return new Promise((subResolve) => {
                (0, csv_parse_1.parse)(buffer, {
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
        }));
        resolve(data.flat());
    });
}
async function copyFromArrayToDB(connection, data) {
    const queryRunner = connection.createQueryRunner();
    const pgConnection = await queryRunner.connect();
    const readableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
        chunkSize: 20480, // in bytes.
    });
    readableStreamBuffer.put(data);
    readableStreamBuffer.stop();
    await (0, promises_1.pipeline)(readableStreamBuffer, pgConnection.query((0, pg_copy_streams_1.from)(`COPY transactions("timestamp", "transactionType", "token", "amount", "portfolio") FROM STDIN (FORMAT csv, HEADER true);`)));
}
function calculatePortfolios(tranactions) {
    let previousPortfolio = null;
    tranactions.forEach((tranaction) => {
        previousPortfolio = (0, portfolio_1.calculatePortfolioForTransaction)(previousPortfolio, tranaction);
    });
}
function arrayToCSV(transactions) {
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
            const convertedLine = `${line.timestamp},${line.transactionType},${line.token},${line.amount}, ${(0, helper_1.stringifyJson)(line.portfolio)}`;
            if (j === 0) {
                csv = convertedLine;
            }
            else {
                csv = csv + '\n' + convertedLine;
            }
        }
        listCsvChunk[i] = Buffer.from(csv);
    }
    let remainderCsv = '';
    for (let i = 0; i < remainder; i++) {
        const line = transactions.pop();
        const convertedLine = `${line.timestamp},${line.transactionType},${line.token},${line.amount}, ${(0, helper_1.stringifyJson)(line.portfolio)}`;
        if (i === 0) {
            remainderCsv = convertedLine;
        }
        else {
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
async function multiProceedCopy(connection, data) {
    const poolSize = 10;
    const executionQuotient = Math.floor(data.length / poolSize);
    const executionRemainder = data.length % poolSize;
    for (let i = 0; i < executionQuotient; i++) {
        const executionData = data.splice(0, poolSize);
        await Promise.all(executionData.map(async (d) => {
            await copyFromArrayToDB(connection, d);
        }));
    }
    if (executionRemainder > 0) {
        const executionData = data.splice(0, executionRemainder);
        await Promise.all(executionData.map(async (d) => {
            await copyFromArrayToDB(connection, d);
        }));
    }
}
async function seed(connection) {
    await readAndPartitionByYear(connection);
    console.log('Partition done');
    const data = await proceedData();
    console.log('Buffer data done');
    await multiProceedCopy(connection, data);
    console.log('Copying data done');
}
exports.default = seed;
