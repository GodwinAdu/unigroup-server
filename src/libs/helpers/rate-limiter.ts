import type { Request, Response, NextFunction } from "express"

interface RateLimitStore {
    [key: string]: {
        count: number
        resetTime: number
    } | undefined
}

const store: RateLimitStore = {}

export const createRateLimiter = (windowMs: number, maxRequests: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const key = req.ip || "unknown"
        const now = Date.now()

        // Clean up expired entries
        Object.keys(store).forEach((k) => {
            const entry = store[k]
            if (entry && entry.resetTime < now) {
                delete store[k]
            }
        })

        if (!store[key]) {
            store[key] = {
                count: 1,
                resetTime: now + windowMs,
            }
            return next()
        }

        if (store[key]!.resetTime < now) {
            store[key] = {
                count: 1,
                resetTime: now + windowMs,
            }
            return next()
        }

        if (store[key]!.count >= maxRequests) {
            return res.status(429).json({
                error: "Too many requests",
                retryAfter: Math.ceil((store[key]!.resetTime - now) / 1000),
            })
        }

        store[key]!.count++
        next()
    }
}

// Rate limiters for different endpoints
export const authRateLimit = createRateLimiter(15 * 60 * 1000, 5) // 5 requests per 15 minutes
export const apiRateLimit = createRateLimiter(60 * 1000, 200) // 200 requests per minute
export const chatRateLimit = createRateLimiter(60 * 1000, 100) // 100 messages per minute