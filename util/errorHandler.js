export class ReqError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}

export const handleError = (error, res) => {
    if (error instanceof ReqError) {
        console.warn(`Handled error: ${error.message}`);
        return res.status(error.status).json({ error: error.message });
    } else {
        console.error(`Unhandled error: ${error.stack}`);
        return res.status(500).json({ error: "An unexpected error occurred." });
    }
}