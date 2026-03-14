import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { ENV } from "@/config/env";

export default function AdminSignupPage() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("service_person");
    const [statusData, setStatusData] = useState<{ message: string; type: "error" | "success" } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatusData(null);
        try {
            const res = await axios.post(`${ENV.API_BASE_URL}/admin/auth/register`, { username, email, password, role });
            if (res.data.success) {
                setStatusData({ message: res.data.message, type: "success" });
                setTimeout(() => navigate("/admin/login"), 3000);
            }
        } catch (err: any) {
            setStatusData({ message: err.response?.data?.message || "Registration failed", type: "error" });
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-neutral-900">
            <div className="bg-neutral-800 p-8 rounded shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-white text-center">Admin Registration</h2>

                {statusData && (
                    <div className={`p-3 rounded mb-4 text-white text-sm ${statusData.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {statusData.message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-300 mb-1">Username</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded bg-neutral-700 text-white border border-neutral-600 outline-none focus:border-blue-500"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
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
                    <div>
                        <label className="block text-gray-300 mb-1">Role</label>
                        <select
                            className="w-full p-2 rounded bg-neutral-700 text-white border border-neutral-600 outline-none focus:border-blue-500"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        >
                            <option value="service_person">Service Person</option>
                            <option value="superadmin">Super Admin</option>
                        </select>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded font-bold transition">
                        Register
                    </button>

                </form>

                <p className="mt-4 text-center text-gray-400">
                    Already registered? <Link to="/admin/login" className="text-blue-400 hover:underline">Log in</Link>
                </p>
            </div>
        </div>
    );
}
