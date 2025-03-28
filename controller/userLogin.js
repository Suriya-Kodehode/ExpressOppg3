import jwt from 'jsonwebtoken';

import { logIn } from "../util/dbQueries.js";
import { hashtoken } from "../util/utility.js";
import { handleError, ReqError } from "../util/errorHandler.js";

export const userLogin = async (req, res) => {
    const { identifier, password } = req.body;

    try {
        if (!identifier || !password) {
            throw new ReqError(400, "Username/Email and password are required");
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new ReqError(500, "Server configuration error");
        }

        const jwtToken = jwt.sign({ identifier }, secret, { expiresIn: '30m' });
        const hashedToken = hashtoken(jwtToken);

        const loginQuery = await logIn(identifier, password, hashedToken);
        if (!loginQuery || typeof loginQuery.UserID === "undefined") {
            throw new ReqError(401, "Invalid username/email or password");
        }

        return res.status(200).json({
            success: true,
            message: "Login successful",
            jwtToken,
            userID: loginQuery.UserID
        });
    } catch (err) {
        console.error("Error during user login:", err.message);
        return handleError(err, res);
    }
};

