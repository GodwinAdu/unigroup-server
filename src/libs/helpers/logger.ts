import type { Request, Response, NextFunction } from "express"

interface LogEntry {
    timestamp: string
    method: string
    url: string
    ip: string
    userAgent?: string | undefined
    statusCode?: number
    responseTime?: number
    error?: string
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()

    const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        ip: req.ip || "unknown",
        userAgent: req.get("User-Agent") || undefined,
    }

    // Override res.end to capture response details
    const originalEnd = res.end
    res.end = function (this: Response, chunk?: any, encoding?: any, cb?: () => void) {
        logEntry.statusCode = res.statusCode
        logEntry.responseTime = Date.now() - startTime

        // Log the request
        if (process.env.NODE_ENV !== "test") {
            console.log(JSON.stringify(logEntry))
        }

        return originalEnd.call(this, chunk, encoding, cb)
    } as any

    next()
}

export const errorLogger = (error: any, req: Request, res: Response, next: NextFunction) => {
    const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        ip: req.ip || "unknown",
        userAgent: req.get("User-Agent") || undefined,
        statusCode: error.status || 500,
        error: error.message || "Unknown error",
    }

    console.error(JSON.stringify(logEntry))
    next(error)
}