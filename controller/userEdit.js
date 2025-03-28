import { editUser } from "../util/dbQueries.js";
import { ReqError } from "../util/errorHandler.js";

export const userEdit = async (req, res) => {
    const { newUsername, newPassword, newEmail } = req.body;
    
    try {
        if (!newUsername && !newPassword && !newEmail) {
            console.warn("No fields provided for update");
            return res.status(400).json({ error: "At least one field of username, password or email must be provided for update." });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.warn("Missing or invalid token in Authorization header");
            return res.status(401).json({ error: "Token is required in the Authorization header." });
        }

        const token = authHeader.slice(7).trim();
        // console.log("Raw token:", token);

        const userEdited = await editUser({ 
            token, 
            newUsername: newUsername ?? null, 
            newPassword: newPassword ?? null, 
            newEmail: newEmail ?? null, 
        });
        // console.log("EditUser response:", userEdited);

        return res.status(200).json({ 
            message: userEdited.message || "User edited successfully",
            updatedField: { 
                newUsername: newUsername || "N/A", 
                newEmail: newEmail || "N/A", 
                newPassword: newPassword ? "******" : null }
        });
    } catch (err) {
        if (err instanceof ReqError) {
            console.error("Request failed", { message: err.message, stack: err.stack, body: req.body });
            return res.status(err.status).json({ error: err.message });
        }
        console.error("Unexpected error during user edit", { message: err.message, stack: err.stack, body: req.body });
        return res.status(500).json({ error: "An unexpected error occurred while editing the user" });
    }
};