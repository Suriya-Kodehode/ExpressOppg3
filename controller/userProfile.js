import { checkUser } from "../util/dbQueries.js";

export const userProfile = async (req, res) => {
    console.info("Request successfully reached userProfile controller");
    try {
        const { identifier } = req.user;
        if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
            console.warn("Invalid identifier provided:", identifier);
            return res.status(400).json({ error: "Invalid user" });
        }

        console.info(`Fetching the user profile ${identifier}`);

        const users = await checkUser({ userName: identifier.toLowerCase(), email: identifier.toLowerCase() });
        console.info("Result from checkUser:", users);
        
        if (!users || users.length === 0) {
            console.warn("No user found for identifier:", identifier);
            return res.status(404).json({ error: "User not found" });
        }

        const userProfile = {
            UserID: users[0].UserID,
            UserName: users[0].UserName,
            Email: users[0].Email,
        }
        console.info(`User profile found: ${JSON.stringify(userProfile)}`);
        return res.status(200).json({
            message: "User fetched successfully",
            profile: userProfile,
        })
    } catch (err) {
        console.error("Error fetching user profile:", err.stack)
        res.status(500).json({ error: "An unexpected error occurred while fetching the user profile" });
    }

}