import { DataSource, DataSourceOptions } from 'typeorm';
import { dataSource } from './ormconfig';

const DBConnection = new DataSource(dataSource as DataSourceOptions);

export default DBConnection;
