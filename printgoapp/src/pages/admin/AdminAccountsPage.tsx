import { useState, useEffect } from "react";
import axios from "axios";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ENV } from "@/config/env";
import { Users, Shield, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";

interface AdminAccount {
    _id: string;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export default function AdminAccountsPage() {
    const { token, user: currentUser } = useAdminAuth();
    const [accounts, setAccounts] = useState<AdminAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAccounts = async () => {
        try {
            const res = await axios.get(`${ENV.API_BASE_URL}/admin/accounts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setAccounts(res.data.admins);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to fetch accounts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser?.role === "superadmin") {
            fetchAccounts();
        } else {
            setLoading(false);
        }
    }, [token, currentUser]);

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const res = await axios.patch(
                `${ENV.API_BASE_URL}/admin/accounts/${id}`,
                { isActive: !currentStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setAccounts(prev => prev.map(acc => acc._id === id ? { ...acc, isActive: !currentStatus } : acc));
            }
        } catch (err: any) {
            alert(err.response?.data?.message || "Update failed");
        }
    };

    const changeRole = async (id: string, newRole: string) => {
        try {
            const res = await axios.patch(
                `${ENV.API_BASE_URL}/admin/accounts/${id}`,
                { role: newRole },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setAccounts(prev => prev.map(acc => acc._id === id ? { ...acc, role: newRole } : acc));
            }
        } catch (err: any) {
            alert(err.response?.data?.message || "Role update failed");
        }
    };

    if (currentUser?.role !== "superadmin") {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-neutral-900 rounded-xl border border-red-900/30">
                <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                <p className="text-gray-400 max-w-md">
                    Only Superadmins have permission to manage administrator accounts.
                    If you believe this is an error, please contact the system owner.
                </p>
            </div>
        );
    }

    if (loading) return <div className="text-white p-6">Loading account list...</div>;
    if (error) return <div className="text-red-500 p-6 bg-red-900/20 rounded-lg">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Users className="text-blue-500" /> Admin Management
                </h1>
                <div className="text-xs text-gray-500 bg-neutral-800 px-3 py-1 rounded-full border border-neutral-700">
                    {accounts.length} Total Administrators
                </div>
            </div>

            <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-neutral-900 text-gray-400 text-sm uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4 font-semibold">User</th>
                            <th className="px-6 py-4 font-semibold">Role</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold">Registered</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700">
                        {accounts.map((acc) => (
                            <tr key={acc._id} className="hover:bg-neutral-750 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{acc.username}</span>
                                        <span className="text-xs text-gray-500">{acc.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {acc.role === "superadmin" ? (
                                            <Shield className="w-4 h-4 text-purple-400" />
                                        ) : (
                                            <Users className="w-4 h-4 text-blue-400" />
                                        )}
                                        <select
                                            value={acc.role}
                                            onChange={(e) => changeRole(acc._id, e.target.value)}
                                            disabled={acc._id === currentUser._id}
                                            className="bg-neutral-700 text-white text-xs rounded border border-neutral-600 px-2 py-1 outline-none focus:border-blue-500 disabled:opacity-50"
                                        >
                                            <option value="service_person">Service Person</option>
                                            <option value="superadmin">Superadmin</option>
                                        </select>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {acc.isActive ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                            <XCircle className="w-3.5 h-3.5" /> Inactive
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400">
                                    {new Date(acc.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => toggleStatus(acc._id, acc.isActive)}
                                        disabled={acc._id === currentUser._id}
                                        className={`px-4 py-1.5 rounded text-sm font-semibold transition shadow-sm ${acc.isActive
                                                ? "bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-600/30"
                                                : "bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white border border-green-600/30"
                                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                                    >
                                        {acc.isActive ? "Deactivate" : "Activate Account"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {accounts.length === 0 && (
                    <div className="py-20 text-center">
                        <Users className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                        <p className="text-gray-500">No admin accounts found.</p>
                    </div>
                )}
            </div>

            <div className="bg-neutral-800/50 p-4 rounded-lg border border-neutral-700/50 flex items-start gap-4">
                <ShieldAlert className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-400 leading-relaxed">
                    <span className="text-yellow-500 font-bold block mb-1 uppercase tracking-tighter">Security Protocol</span>
                    Inactive accounts cannot log in or access the dashboard. Newly registered admins are inactive by default to prevent unauthorized access.
                    Exercise caution when granting <span className="text-purple-400 font-medium">Superadmin</span> roles as they can manage other administrators and entire kiosk network.
                </div>
            </div>
        </div>
    );
}
