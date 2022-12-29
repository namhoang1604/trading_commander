import { DataSource } from 'typeorm';
import { TransactionEntity } from '../entities/transaction.entity';
import { round } from '../helper';
import { fetchPrices } from './exchange';

export function calculatePortfolioForTransaction(
  previousTransaction: any,
  transaction: any,
) {
  const portfolio: any = { ...previousTransaction };
  transaction.amount = +transaction.amount;
  switch (transaction.transactionType) {
    case 'DEPOSIT': {
      portfolio[transaction.token] = round(
        (portfolio[transaction.token] || 0) + transaction.amount,
      );
      break;
    }
    case 'WITHDRAWAL': {
      portfolio[transaction.token] = round(
        (portfolio[transaction.token] || 0) - transaction.amount,
      );
      break;
    }
    default:
      break;
  }
  transaction.portfolio = portfolio;
  return portfolio;
}

type TransactionsGroupedByToken = {
  [key: string]: TransactionEntity[];
};
type Portfolio = {
  [key: string]: number;
};

async function updatePriceForPortfolios(
  connection: DataSource,
  transactions: TransactionEntity[],
) {
  const convertedTranactions = transactions.filter((t) => {
    return Object.keys(t.portfolio).some((key) => key.includes('USD'));
  });
  const notConvertedTranactions = transactions.filter((t) => {
    return !Object.keys(t.portfolio).some((key) => key.includes('USD'));
  });
  const transactionsGroupedByToken = notConvertedTranactions.reduce(
    (acc: TransactionsGroupedByToken, t) => {
      return Object.keys(t.portfolio).reduce(
        (subAcc: TransactionsGroupedByToken, key) => {
          if (subAcc[key]) {
            subAcc[key] = [...subAcc[key], t];
          } else {
            subAcc[key] = [t];
          }
          return subAcc;
        },
        acc,
      );
    },
    {},
  );

  const tokenMaxMinTimestamps = Object.keys(transactionsGroupedByToken).map(
    (token) => {
      const sortedTrans = transactionsGroupedByToken[token].sort(
        (a, b) => a.timestamp - b.timestamp,
      );
      const minTimestamp = sortedTrans[0].timestamp;
      const maxTimestamp = sortedTrans[sortedTrans.length - 1].timestamp;
      return { token, minTimestamp, maxTimestamp };
    },
  );

  const tokenPricesByTime = await Promise.all(
    tokenMaxMinTimestamps.map(async ({ token, minTimestamp, maxTimestamp }) => {
      const flooredMinTimestamp = minTimestamp - (minTimestamp % 3600);
      const ceiledMaxTimestamp = maxTimestamp - (maxTimestamp % 3600) + 3600;
      const limit = (ceiledMaxTimestamp - flooredMinTimestamp) / 3600;

      const pricesByTime = await fetchPrices({
        token,
        limit,
        endDate: ceiledMaxTimestamp,
      });
      return { token, pricesByTime };
    }),
  );

  const updatedPricedTransactions = notConvertedTranactions.map((t) => {
    const exchangedPortfolio = Object.keys(t.portfolio).reduce(
      (acc: Portfolio, key) => {
        const price = tokenPricesByTime
          .find(({ token }) => token === key)
          ?.pricesByTime.find(({ time }) => {
            return t.timestamp >= time && t.timestamp < time + 3600;
          })?.price;

        const balance: number = (t.portfolio as Portfolio)[key];
        if (price) {
          acc[`${key}_USD`] = round(balance * price);
        }
        return acc;
      },
      {},
    );
    t.portfolio = { ...t.portfolio, ...exchangedPortfolio };
    return t;
  });

  const transactionRepository = connection.getRepository(TransactionEntity);
  if (updatedPricedTransactions.length > 0) {
    await transactionRepository.upsert(updatedPricedTransactions, {
      conflictPaths: ['timestamp', 'transactionType', 'token', 'amount'],
    });
  }

  return [...updatedPricedTransactions, ...convertedTranactions].sort(
    (a, b) => b.timestamp - a.timestamp,
  );
}

type PortfolioParams = {
  date: number;
};

export async function getPortfolios(
  connection: DataSource,
  params: PortfolioParams,
) {
  const transactionRepository = connection.getRepository(TransactionEntity);
  const query = transactionRepository
    .createQueryBuilder('t')
    .orderBy('t.timestamp', 'DESC');

  if (params.date) {
    const nextDate = params.date + 24 * 60 * 60;
    query.andWhere('t.timestamp >= :startDate AND t.timestamp < :endDate', {
      startDate: params.date,
      endDate: nextDate,
    });
  } else {
    query.limit(1);
  }
  const tranactions = await query.getMany();
  return updatePriceForPortfolios(connection, tranactions);
}
