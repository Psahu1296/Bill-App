import { Request, Response, NextFunction } from "express";
import config from "../config/config";

const globalErrorHandler = (err: Error & { statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
        status: statusCode,
        message: err.message,
        errorStack: config.nodeEnv === "development" ? err.stack : ""
    })
}

export default globalErrorHandler;