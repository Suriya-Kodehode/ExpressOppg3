import {config}from 'dotenv';
config();

import express from 'express';

import crypto from 'crypto';
import fs from 'fs';
import cors from 'cors';

import userRouter from './users.js';

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
}))

app.use(express.json());

app.use('/api', userRouter);

const transformToLowercase = (obj, preserveKeys = []) => {
    if (!obj || typeof obj !== "object") {
        return obj;
    }
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
            preserveKeys.includes(key) ? key : key.toLowerCase(),
            typeof value === 'string' && !preserveKeys.includes(key) ? value.toLowerCase() : value,
        ])
    );
};

app.use((req, res, next) => {
    const preserveKeys = ['Password'];
    if (req.body) req.body = transformToLowercase(req.body, preserveKeys);
    if (req.query) req.query = transformToLowercase(req.query, preserveKeys);
    if (req.params) req.params = transformToLowercase(req.params, preserveKeys);
    next();
});

const ENV_FILE_PATH = '.env';
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    if (fs.existsSync(ENV_FILE_PATH)) {
        const envConfig = fs.readFileSync(ENV_FILE_PATH, 'utf-8').split('\n');
        const jwtSecretLine = envConfig.find(line => line.startsWith('JWT_SECRET='));
        if (jwtSecretLine) {
            return jwtSecretLine.split('=')[1].trim();
        }
    }
    const secret = crypto.randomBytes(64).toString('hex');
    fs.appendFileSync(ENV_FILE_PATH, `JWT_SECRET=${secret}\n`);
    return secret;
})();
// console.log('JWT_SECRET is set and consistent:', JWT_SECRET);


export default app;