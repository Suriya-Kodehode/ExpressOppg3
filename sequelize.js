import sequelize from 'sequelize';
import {config} from 'dotenv';
config();

const db = new sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mssql',
    }
)

export default db;