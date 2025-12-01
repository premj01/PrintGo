import { useState } from "react";

export default function LoginGoogle() {
  const [user, setUser] = useState<any>(null);

  const handleLogin = async () => {
    // Open Google OAuth in new window
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=160922067134-h5hkb7bt91u2spe1nl4t0h3lo6h3a2vv.apps.googleusercontent.com&redirect_uri=http://localhost:5173/oauth-callback&response_type=code&scope=openid email profile`;
    window.location.href = googleAuthUrl;
  };

  return (
    <div>
      {user ? (
        <div>
          <h2>Welcome, {user.name}</h2>
        </div>
      ) : (
        <button onClick={handleLogin}>Login with Google</button>
      )}
    </div>
  );
}
