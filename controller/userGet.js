

import { getAllUsers } from "../util/dbQueries.js";
import { ReqError } from "../util/errorHandler.js";

export const userGet = async (req, res) => {
    try {
        const users = await getAllUsers();

        return res.status(200).json({message: "User fetched successfully", users});
    } catch (err) {
        if (err instanceof ReqError) {
            return res.status(err.status).json({error: err.message});
        }
        console.error("Error fetching users", err.stack);
        return res.status(500).json({error: "An unexpected error occurred while fetching users"});
    }
}