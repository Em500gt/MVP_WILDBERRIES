import type { Knex } from "knex";
import dotenv from 'dotenv';
dotenv.config();

const knexConfig: Knex.Config = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: parseInt(process.env.DB_PORT || '5432', 10)
    },
    migrations: {
        directory: 'src/config/migrations',
    },
};

export default knexConfig;