import type { Request, Response, NextFunction } from "express"

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
    // Remove server header
    res.removeHeader("X-Powered-By")

    // Add security headers
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")
    res.setHeader("X-XSS-Protection", "1; mode=block")
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    next()
}

export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "POST" || req.method === "PUT") {
        const contentType = req.get("Content-Type")

        if (!contentType) {
            return res.status(400).json({ error: "Content-Type header is required" })
        }

        if (!contentType.includes("application/json") && !contentType.includes("multipart/form-data")) {
            return res.status(400).json({ error: "Invalid Content-Type" })
        }
    }

    next()
}

export const sanitizeBody = (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === "object") {
        const sanitize = (obj: any): any => {
            if (typeof obj === "string") {
                return obj.trim().replace(/[<>]/g, "")
            }

            if (Array.isArray(obj)) {
                return obj.map(sanitize)
            }

            if (obj && typeof obj === "object") {
                const sanitized: any = {}
                for (const [key, value] of Object.entries(obj)) {
                    sanitized[key] = sanitize(value)
                }
                return sanitized
            }

            return obj
        }

        req.body = sanitize(req.body)
    }

    next()
}