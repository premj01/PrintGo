import express from "express";
const router = express.Router();
import fs from "fs";
import path from "path";
import axios from "axios";
import jwt from "jsonwebtoken";

const secretPath = path.resolve("./client_secret_160922067134-h5hkb7bt91u2spe1nl4t0h3lo6h3a2vv.apps.googleusercontent.com.json");
const secret = JSON.parse(fs.readFileSync(secretPath, "utf-8"));

const CLIENT_ID = secret.web.client_id;
const CLIENT_SECRET = secret.web.client_secret;
const REDIRECT_URI = "http://localhost:5173/oauth-callback";

router.post("/google", async (req, res) => {
  const { code } = req.body;
  // log("Received code:", code);
  try {
    // 1. Exchange code for tokens
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

    const { id_token, access_token } = tokenRes.data;
    // log("Received tokens:", { id_token, access_token });
    // 2. Decode / verify ID token
    // For production: verify signature using Google's public keys
    const user = jwt.decode(id_token);
    // log("Decoded user info:", user);

    // 3. Create your own JWT for client
    const appToken = jwt.sign(
      { email: user.email, name: user.name },
      "YOUR_APP_SECRET",
      { expiresIn: "1h" }
    );
    // console.log(user.email);

    res.json({ token: appToken, user: { email: user.email, name: user.name, picture: user.picture } });
  } catch (err) {
    // console.error(err);
    res.status(400).json({ error: "Google login failed" });
  }
})

router.get("/pr", (req, res) => {
  console.log("testing auth routes");
  res.send("auth route testing successful");
})


export default router;