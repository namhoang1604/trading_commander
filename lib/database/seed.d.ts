import { DataSource } from 'typeorm';
declare function seed(connection: DataSource): Promise<void>;
export default seed;
