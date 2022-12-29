"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPortfolios = exports.calculatePortfolioForTransaction = void 0;
const transaction_entity_1 = require("../entities/transaction.entity");
const helper_1 = require("../helper");
const exchange_1 = require("./exchange");
function calculatePortfolioForTransaction(previousTransaction, transaction) {
    const portfolio = Object.assign({}, previousTransaction);
    transaction.amount = +transaction.amount;
    switch (transaction.transactionType) {
        case 'DEPOSIT': {
            portfolio[transaction.token] = (0, helper_1.round)((portfolio[transaction.token] || 0) + transaction.amount);
            break;
        }
        case 'WITHDRAWAL': {
            portfolio[transaction.token] = (0, helper_1.round)((portfolio[transaction.token] || 0) - transaction.amount);
            break;
        }
        default:
            break;
    }
    transaction.portfolio = portfolio;
    return portfolio;
}
exports.calculatePortfolioForTransaction = calculatePortfolioForTransaction;
async function updatePriceForPortfolios(connection, transactions) {
    const convertedTranactions = transactions.filter((t) => {
        return Object.keys(t.portfolio).some((key) => key.includes('USD'));
    });
    const notConvertedTranactions = transactions.filter((t) => {
        return !Object.keys(t.portfolio).some((key) => key.includes('USD'));
    });
    const transactionsGroupedByToken = notConvertedTranactions.reduce((acc, t) => {
        return Object.keys(t.portfolio).reduce((subAcc, key) => {
            if (subAcc[key]) {
                subAcc[key] = [...subAcc[key], t];
            }
            else {
                subAcc[key] = [t];
            }
            return subAcc;
        }, acc);
    }, {});
    const tokenMaxMinTimestamps = Object.keys(transactionsGroupedByToken).map((token) => {
        const sortedTrans = transactionsGroupedByToken[token].sort((a, b) => a.timestamp - b.timestamp);
        const minTimestamp = sortedTrans[0].timestamp;
        const maxTimestamp = sortedTrans[sortedTrans.length - 1].timestamp;
        return { token, minTimestamp, maxTimestamp };
    });
    const tokenPricesByTime = await Promise.all(tokenMaxMinTimestamps.map(async ({ token, minTimestamp, maxTimestamp }) => {
        const flooredMinTimestamp = minTimestamp - (minTimestamp % 3600);
        const ceiledMaxTimestamp = maxTimestamp - (maxTimestamp % 3600) + 3600;
        const limit = (ceiledMaxTimestamp - flooredMinTimestamp) / 3600;
        const pricesByTime = await (0, exchange_1.fetchPrices)({
            token,
            limit,
            endDate: ceiledMaxTimestamp,
        });
        return { token, pricesByTime };
    }));
    const updatedPricedTransactions = notConvertedTranactions.map((t) => {
        const exchangedPortfolio = Object.keys(t.portfolio).reduce((acc, key) => {
            var _a, _b;
            const price = (_b = (_a = tokenPricesByTime
                .find(({ token }) => token === key)) === null || _a === void 0 ? void 0 : _a.pricesByTime.find(({ time }) => {
                return t.timestamp >= time && t.timestamp < time + 3600;
            })) === null || _b === void 0 ? void 0 : _b.price;
            const balance = t.portfolio[key];
            if (price) {
                acc[`${key}_USD`] = (0, helper_1.round)(balance * price);
            }
            return acc;
        }, {});
        t.portfolio = Object.assign(Object.assign({}, t.portfolio), exchangedPortfolio);
        return t;
    });
    const transactionRepository = connection.getRepository(transaction_entity_1.TransactionEntity);
    if (updatedPricedTransactions.length > 0) {
        await transactionRepository.upsert(updatedPricedTransactions, {
            conflictPaths: ['timestamp', 'transactionType', 'token', 'amount'],
        });
    }
    return [...updatedPricedTransactions, ...convertedTranactions].sort((a, b) => b.timestamp - a.timestamp);
}
async function getPortfolios(connection, params) {
    const transactionRepository = connection.getRepository(transaction_entity_1.TransactionEntity);
    const query = transactionRepository
        .createQueryBuilder('t')
        .orderBy('t.timestamp', 'DESC');
    if (params.date) {
        const nextDate = params.date + 24 * 60 * 60;
        query.andWhere('t.timestamp >= :startDate AND t.timestamp < :endDate', {
            startDate: params.date,
            endDate: nextDate,
        });
    }
    else {
        query.limit(1);
    }
    const tranactions = await query.getMany();
    return updatePriceForPortfolios(connection, tranactions);
}
exports.getPortfolios = getPortfolios;
