import fs from "fs";
import path from "path";
import axios from "axios";
import jwt from "jsonwebtoken";

const secretPath = path.resolve("./client_secret_160922067134-h5hkb7bt91u2spe1nl4t0h3lo6h3a2vv.apps.googleusercontent.com.json");
const secret = JSON.parse(fs.readFileSync(secretPath, "utf-8"));

const CLIENT_ID = secret.web.client_id;
const CLIENT_SECRET = secret.web.client_secret;
const REDIRECT_URI = "http://localhost:5173/oauth-callback";

export async function googleLogin(req, res) {
    const { code } = req.body;

    try {
        const tokenRes = await axios.post(
            "https://oauth2.googleapis.com/token",
            new URLSearchParams({
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: "authorization_code",
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { id_token } = tokenRes.data;
        const user = jwt.decode(id_token);

        const appToken = jwt.sign(
            { email: user.email, name: user.name },
            "YOUR_APP_SECRET",
            { expiresIn: "1h" }
        );

        return res.json({
            token: appToken,
            user: { email: user.email, name: user.name, picture: user.picture },
        });
    } catch (err) {
        return res.status(400).json({ error: "Google login failed" });
    }
}

export function authProbe(req, res) {
    console.log("testing auth routes");
    res.send("auth route testing successful");
}
