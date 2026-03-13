import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "10m" });
}

export const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
}