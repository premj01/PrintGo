import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ENV } from "@/config/env";
import { Server, AlertCircle, MapPin, CheckCircle } from "lucide-react";

interface KioskData {
    _id: string;
    kioskId: string;
    kioskName: string;
    isActive: boolean;
    newConnection: boolean;
    location?: { region: string; city: string; };
    liveConnected?: boolean;
    agentConnected?: boolean;
}

export default function AdminDashboardPage() {
    const { token } = useAdminAuth();
    const [kiosks, setKiosks] = useState<KioskData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchKiosks = async () => {
            try {
                const res = await axios.get(`${ENV.API_BASE_URL}/admin/kiosks`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setKiosks(res.data.kiosks);
                }
            } catch (err) {
                console.error("Failed to fetch kiosks", err);
            } finally {
                setLoading(false);
            }
        };

        fetchKiosks();
        // Refresh every 10 seconds for live connection status
        const interval = setInterval(fetchKiosks, 10000);
        return () => clearInterval(interval);
    }, [token]);

    if (loading) return <div className="text-white">Loading Dashboard...</div>;

    const newKiosks = kiosks.filter(k => k.newConnection);
    const inactiveKiosks = kiosks.filter(k => !k.isActive && !k.newConnection);
    const activeKiosks = kiosks.filter(k => k.isActive);

    // Group by region
    const regions = Array.from(new Set(kiosks.map(k => k.location?.region).filter(Boolean))) as string[];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-neutral-800 p-6 rounded-lg shadow border border-neutral-700">
                    <div className="flex items-center gap-3">
                        <Server className="w-8 h-8 text-blue-500" />
                        <div>
                            <p className="text-gray-400 text-sm">Total Kiosks</p>
                            <h3 className="text-2xl font-bold text-white">{kiosks.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-neutral-800 p-6 rounded-lg shadow border border-yellow-700">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-yellow-500" />
                        <div>
                            <p className="text-gray-400 text-sm">New Approvals</p>
                            <h3 className="text-2xl font-bold text-yellow-500">{newKiosks.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-neutral-800 p-6 rounded-lg shadow border border-red-700">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                        <div>
                            <p className="text-gray-400 text-sm">Inactive</p>
                            <h3 className="text-2xl font-bold text-red-500">{inactiveKiosks.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-neutral-800 p-6 rounded-lg shadow border border-green-700">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                        <div>
                            <p className="text-gray-400 text-sm">Active</p>
                            <h3 className="text-2xl font-bold text-green-500">{activeKiosks.length}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Regions Quick Links */}
            <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <MapPin className="text-blue-500" /> Regions
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {regions.length === 0 && <p className="text-gray-400">No regions recorded yet.</p>}
                    {regions.map(region => (
                        <Link
                            key={region}
                            to={`/admin/regions/${encodeURIComponent(region)}`}
                            className="bg-neutral-700 hover:bg-neutral-600 p-4 rounded text-center transition shadow-sm text-white font-medium block"
                        >
                            {region}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Actionable Kiosk Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Pending New Connections */}
                <div className="bg-neutral-800 rounded-lg border border-yellow-700/50 p-6">
                    <h2 className="text-xl font-bold text-yellow-500 mb-4">Pending New Kiosks</h2>
                    {newKiosks.length === 0 ? <p className="text-gray-400">No pending kiosks.</p> : (
                        <div className="space-y-3">
                            {newKiosks.map(k => (
                                <div key={k._id} className="bg-neutral-700 p-4 rounded flex justify-between items-center">
                                    <div>
                                        <h4 className="font-bold text-white">{k.kioskName}</h4>
                                        <p className="text-xs text-gray-400 font-mono">{k.kioskId}</p>
                                    </div>
                                    <Link
                                        to={`/admin/kiosk/${k.kioskId}`}
                                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition"
                                    >
                                        Review
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Inactive Kiosks */}
                <div className="bg-neutral-800 rounded-lg border border-red-700/50 p-6">
                    <h2 className="text-xl font-bold text-red-500 mb-4">Inactive Kiosks</h2>
                    {inactiveKiosks.length === 0 ? <p className="text-gray-400">No inactive kiosks.</p> : (
                        <div className="space-y-3">
                            {inactiveKiosks.map(k => (
                                <div key={k._id} className="bg-neutral-700 p-4 rounded flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-white">{k.kioskName}</h4>
                                            {k.agentConnected && <span className="w-2 h-2 rounded-full bg-green-500" title="Agent Online"></span>}
                                        </div>
                                        <p className="text-xs text-gray-400 font-mono">{k.kioskId}</p>
                                    </div>
                                    <Link
                                        to={`/admin/kiosk/${k.kioskId}`}
                                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
                                    >
                                        Manage
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
