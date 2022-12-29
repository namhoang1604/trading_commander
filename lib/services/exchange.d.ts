type QueryParams = {
    token: string;
    endDate: number;
    limit: number;
};
type PriceByTime = {
    time: number;
    price: number;
};
export declare function fetchPrices(params: QueryParams): Promise<PriceByTime[]>;
export {};
