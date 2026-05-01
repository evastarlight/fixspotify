import "dotenv/config"
import { PostgreSqlDriver } from "@mikro-orm/postgresql";

const config = {
    entities: [
        'dist/database/entities/*.js',
    ],
    entitiesTs: [
        'src/database/entities/*.ts',
    ],
    driver: PostgreSqlDriver,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    dbName: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    debug: true
};

export default config;