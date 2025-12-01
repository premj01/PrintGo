import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get("code");
    console.log(code);

    if (!code) return;

    // Send code to server
    fetch("http://localhost:3000/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => res.json())
      .then((data) => {
        localStorage.setItem("token", data.token); // store your app JWT
        console.log(data.user);

        localStorage.setItem("user", JSON.stringify(data.user)); // store your app JWT
        navigate("/"); // redirect after login
      });
  }, []);

  return <div>Loading...</div>;
}
