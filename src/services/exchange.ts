require('dotenv').config();
import axios from 'axios';

const cryptocompareAPI = process.env.CRYPTOCOMPARE_API as string;
const cryptocompareAPIKey = process.env.CRYPTOCOMPARE_API_KEY as string;

type QueryParams = {
  token: string;
  endDate: number;
  limit: number;
};
type PriceByTime = {
  time: number;
  price: number;
};
export async function fetchPrices(params: QueryParams): Promise<PriceByTime[]> {
  const response = await axios
    .get(
      `${cryptocompareAPI}/histohour?fsym=${params.token}&tsym=USD&limit=${params.limit}&toTs=${params.endDate}&api_key=${cryptocompareAPIKey}`,
    )
    .then((response) => response.data);

  if (response.Response === 'Success') {
    return response.Data.Data.map((d: any) => ({
      time: d.time,
      price: d.close,
    }));
  }
  throw 'Something went wrong';
}
