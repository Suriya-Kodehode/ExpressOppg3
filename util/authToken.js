import jwt from 'jsonwebtoken';
import { validateToken } from './dbQueries.js';
import { hashtoken } from './utility.js';

const authToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        // console.log("Authorization header:", authHeader);

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            // console.log("Authorization header missing or invalid:", authHeader);
            return res.status(401).json({ message: "No token provided" });
        }

        const token = authHeader.slice(7).trim();
        // console.log("Received token:", token);

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("JWT_SECRET is not defined in the environment variables");
            return res.status(500).json({ message: "Server configuration error" });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, secret);
            // console.log("Decoded token (verified):", decoded);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Token as expired." });
            } else if (err.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: "Invalid token." });
            } else {
                throw err;
            }
        }
        
        const hashedToken = hashtoken(token);
        // console.log("Hashed token:", hashedToken.toString('hex'));

        const tokenValid = await validateToken(hashedToken);
        if (!tokenValid) {
            console.error("Token is invalid or expired in the database");
            return res.status(401).json({ message: "Invalid or expired token" });
        }

        req.user = decoded;
        next();
    } catch (err) {
        console.error("Token verification failed:", err.message);
        return res.status(401).json({ message: "Invalid or expired token", error: err.message });
    }
}

export default authToken;