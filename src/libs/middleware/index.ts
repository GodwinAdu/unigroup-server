import { NextFunction,Request,Response } from "express"
import jwt from "jsonwebtoken"
import User from "../../models/user.models"



export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "")

        if (!token) {
            return res.status(401).json({ error: "Access denied. No token provided." })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
        const user = await User.findById(decoded.userId)

        if (!user) {
            return res.status(401).json({ error: "Invalid token." })
        }

        req.user = user
        next()
    } catch (error) {
        res.status(401).json({ error: "Invalid token." })
    }
}