import { useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ENV } from "@/config/env";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

export default function AdminLoginPage() {
    const { login } = useAdminAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await axios.post(`${ENV.API_BASE_URL}/admin/auth/login`, { email, password });
            if (res.data.success) {
                login(res.data.token, {
                    _id: res.data._id,
                    username: res.data.username,
                    email: res.data.email,
                    role: res.data.role
                });
                navigate("/admin");
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Login failed");
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-neutral-900">
            <div className="bg-neutral-800 p-8 rounded shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-white text-center">Admin Login</h2>
                {error && <div className="bg-red-500 text-white p-3 rounded mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-300 mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full p-2 rounded bg-neutral-700 text-white border border-neutral-600 outline-none focus:border-blue-500"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-gray-300 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full p-2 rounded bg-neutral-700 text-white border border-neutral-600 outline-none focus:border-blue-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded font-bold transition">
                        Login
                    </button>

                </form>

                <p className="mt-4 text-center text-gray-400">
                    Need an account? <Link to="/admin/signup" className="text-blue-400 hover:underline">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
