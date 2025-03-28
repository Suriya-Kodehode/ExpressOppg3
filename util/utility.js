import crypto from 'crypto';

export const hashtoken = (token) => {
    return crypto.createHash('sha512').update(token).digest();
}
export const log = (level, message, details = {}) => {
    console[level](`[${new Date().toISOString()}] ${message}`, details);
};

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
