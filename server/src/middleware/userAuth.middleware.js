import { verifyToken } from "../util/jwt.util.js";

export function requireUserAuth(req, res, next) {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token);

        req.user = decoded;
        req.userSessionNumber = decoded.userSessionNumber;

        if (!req.userSessionNumber) {
            return res.status(401).json({ message: "Invalid token payload" });
        }

        return next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
