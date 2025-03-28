import db from '../sequelize.js';
import { hashtoken, log } from './utility.js';
import { ReqError } from './errorHandler.js';

const executeStoredProcedure = async (query, replacements) => {
    const [result] = await db.query(query, { replacements, type: db.QueryTypes.SELECT });
    const ReturnCode = result?.ReturnCode ?? undefined;

    if (typeof ReturnCode === "undefined") {
        throw new ReqError(500, "Unexpected response from stored procedure.");
    }
    return ReturnCode;
};

export const addUser = async({email, userName, password}) => {
    try {
        if (!email || !password) {
            throw new ReqError(400, "Email and password are required");
        }
        const finalUserName = userName || null;
        
        // console.log("Parameters passed to sp_SignUp", { userName: finalUserName, email, password });

        const [result] = await db.query(
            `
            DECLARE @ReturnCode INT;
            EXEC @ReturnCode = sp_SignUp @Username = :userName, @Email = :email, @Password = :password;
            SELECT @ReturnCode as ReturnCode;
            `,
            {
                replacements: { userName: finalUserName, email, password },
                type: db.QueryTypes.SELECT,
            }
        )
        console.log("Procedure response:", result);

        const returnCode = result?.ReturnCode;
        if (typeof returnCode === "undefined") {
            throw new ReqError(500, "Unexpected response from sp_SignUp.");
        }

        switch (returnCode) {
            case 0:
                return { 
                    success: true, 
                    message: "User signup successfully",
                    data: { userName: finalUserName, email }
                };
            case -1:
                throw new ReqError(400, "Email and password are required.")
            case -2:
                throw new ReqError(409, "Email already exists");
            case -3:
                throw new ReqError(409, "Username already exists");
            case -4:
                throw new ReqError(500, "An unexpected error occurred during signup");
            default:
                console.error("Unexpected return code from sp_SignUp:", returnCode);
                throw new ReqError(500, "Unknown error occurred during signup");
        }
    } catch (err) {
        console.error("Error during addUser execution:", err.message);
        throw new ReqError(
            err.status || 500,
            err.message || "Error signing up user"
        );
    }
}

export const checkUser = async ({userName, email}) => {
    try {
        if (!userName && !email) {
            throw new ReqError(400, "Username or email must be provided");
        }

        // console.log(`[INFO]: Checking for user - Username: ${userName || 'N/A'}, Email: ${email || 'N/A'}`);

        const query = `
            SELECT UserID, UserName, Email 
            FROM t_Users
            WHERE LOWER(Username) = LOWER(:userName) OR LOWER(Email) = LOWER(:email);
        `;
        const replacements = { userName: userName ?? null, email: email ?? null };

        const results = await db.query(query, {
            replacements,
            type: db.QueryTypes.SELECT,
        });
        // console.log("Raw results from checkUser query:", results);
        if (!Array.isArray(results)) {
            console.error("Unexpected response format:", results)
            throw new ReqError(500, "Unexpected response format from database query");
        }

        if (results.length === 0) {
            console.log("No user found.");
            return null;
        }

        console.log("User(s) found:", results);
        return results
    } catch (err) {
        console.error('Error checking for user', err.stack)
        throw new ReqError(500, 'Error checking for user');
    }
}

export const getAllUsers = async () => {
    try {
        const [users] = await db.query(
            `SELECT UserID, UserName, Email FROM t_Users`, 
            {
                type: db.QueryTypes.SELECT
            }
        )
        return users || [];
    } catch (err) {
        console.error("Error fetching users", err.stack);
        throw new ReqError(500, "Error fetching users");
    }
}

export const logIn = async (identifier, password, token) => {
    try {
        console.log("Parameters passed to sp_Login", { identifier, token: token.toString('hex').slice(0, 10)});
        const [result] = await db.query(
            `
            DECLARE @ReturnCode INT;
            DECLARE @UserID BIGINT;
            EXECUTE sp_Login
                @Identifier = :identifier,
                @Password = :password,
                @Token = :token,
                @UserID = @UserID OUTPUT,
                @ReturnCode = @ReturnCode OUTPUT;
            SELECT  @ReturnCode AS ReturnCode, @UserID AS UserID;
            `,
            {
                replacements: {  identifier, password, token },
                type: db.QueryTypes.SELECT,
            }
        )

        console.log("Raw response from sp_Login:", result);

        if (!result || typeof result.ReturnCode === "undefined") {
            console.warn("Unexpected response from sp_Login:", result);
            throw new ReqError(500, "Unexpected response from login query");
        }

        switch (result.ReturnCode) {
            case 0: 
                return result;
            case -1:
                console.warn(`Invalid login attempt for identifier: ${identifier}`);
                throw new ReqError(401, "Invalid username/email or password.")
            case -2:
                console.error(`Database error during login for identifier: ${identifier}`);
                throw new ReqError(500, "A database error occurred during login.")
            default:
                console.error("Unhandled ReturnCode from sp_Login:", result.ReturnCode);
                throw new ReqError(500, "An unexpected error occurred during login.");
        }
        
    } catch (err) {
        console.error("Error executing sp_Login for identifier:", identifier, err.stack);
        throw new ReqError(500, `Database error occurred during login: ${err.message}`);
    }
}

export const editUser = async ({ token, newUsername, newPassword, newEmail }) => {
    try {
        if (!token) throw new ReqError(400, "Token is required");
        if (!newUsername && !newPassword && !newEmail) {
            throw new ReqError(400, "At least one field must be provided for update.");
        }

        const hashedToken = hashtoken(token);
        log('info', "Hashed token generated for EditUser", { token: token.slice(0, 10) });

        const query = 
            `
            DECLARE @ReturnCode INT;
            EXEC sp_EditUser
                @Token = :hashedToken,
                @NewUsername = :newUsername,
                @NewPassword = :newPassword,
                @NewEmail = :newEmail,
                @ReturnCode = @ReturnCode OUTPUT;
            SELECT @ReturnCode AS ReturnCode;
            `
            const ReturnCode = await executeStoredProcedure(query, {
                hashedToken,
                newUsername: newUsername ?? null,
                newPassword: newPassword ?? null,
                newEmail: newEmail ?? null,
            })
        switch (ReturnCode) {
            case -1:
                console.error("EditUser failed: Invalid or expired token");
                throw new ReqError(401, "Invalid or expired token");
            case -2:
                console.error("EditUser failed: Username already exists");
                throw new ReqError(400, "Username already exists");
            case -3:
                console.error("EditUser failed: Email already exists");
                throw new ReqError(400, "Email already exists");
            case -4:
                console.error("EditUser failed: Unexpected error occurred during user edit");
                throw new ReqError(500, "Unexpected error occurred during user edit");
            case 0:
                log('info', "Edituser operation successful", { newUsername, newEmail });
                return { success: true, message: "User updated successfully" };
            default:
                console.error(`EditUser failed: Unknown error occurred in edit user query. ReturnCode: ${ReturnCode}`);
                throw new ReqError(500, "Unknown error occurred in edit user query");
        }
        
    } catch (err) {
        log('error', "Error during EditUser operation", { error: err.message })
        throw err;
    }
}

export const validateToken = async (hashedToken) => {
    try {
        // console.log("Validating hashed token:", hashedToken.toString('hex'));
        const [tokenValid] = await db.query(
             `
            SELECT CASE
                WHEN COUNT(*) > 0 THEN 1
                ELSE 0
            END AS IsValid
            FROM t_UsersTokens
            WHERE Token = :hashedtoken
            AND TokenValidDate > GETDATE();      
            `,
            {
                replacements: { hashedtoken: hashedToken },
                type: db.QueryTypes.SELECT,
            }
        )
        // console.log("Token validation response from DB:", tokenValid);

        if (!tokenValid || !tokenValid.IsValid) {
            if (new Date(tokenValid.TokenValidDate) <= new Date()) {
                console.warn("Token expired:", hashedToken.toString('hex').slice(0, 10));
                throw new ReqError(401, "Token has expired. Please log in again.");
            }
            throw new ReqError(401, "Invalid or expired token");
        }
        return true;
    } catch (err) {
        console.error("Error validating token in database:", err.stack);
        throw new ReqError(500, `Error validating token: ${err.message}`);
    }
}