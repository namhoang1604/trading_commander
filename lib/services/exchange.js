"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPrices = void 0;
require('dotenv').config();
const axios_1 = __importDefault(require("axios"));
const cryptocompareAPI = process.env.CRYPTOCOMPARE_API;
const cryptocompareAPIKey = process.env.CRYPTOCOMPARE_API_KEY;
async function fetchPrices(params) {
    const response = await axios_1.default
        .get(`${cryptocompareAPI}/histohour?fsym=${params.token}&tsym=USD&limit=${params.limit}&toTs=${params.endDate}&api_key=${cryptocompareAPIKey}`)
        .then((response) => response.data);
    if (response.Response === 'Success') {
        return response.Data.Data.map((d) => ({
            time: d.time,
            price: d.close,
        }));
    }
    throw 'Something went wrong';
}
exports.fetchPrices = fetchPrices;
