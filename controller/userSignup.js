

import { addUser, checkUser } from "../util/dbQueries.js";
import { ReqError } from "../util/errorHandler.js";
import { emailRegex } from "../util/utility.js";

export const userSignup = async (req, res) => {
    const {userName, email, password} = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({error: "Email and password are required"});
        }
        
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }

        const existingUser = await checkUser({ userName, email });
       if (existingUser) {
            const conflictField = existingUser[0]?.Email === email ? "Email" : "Username";
            throw new ReqError(409, `${conflictField} already exists`);
       }

        const response = await addUser({ email, userName: userName || null, password })
        console.log("Response from addUser:", response);
        
        return res.status(201).json({ message: "User has signed up successfully"});
    } catch (err) {
        if (err instanceof ReqError) {
            console.error("ReqError caught:", { status: err.status, message: err.message })
            return res.status(err.status).json({error: err.message});
        }
        console.error("Unexpected error during userSignup:", err.message);
        return res.status(500).json({error: "An unexpected error occurred during signup"});
    }
}