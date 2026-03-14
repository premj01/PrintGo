import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ENV } from "@/config/env";
import { Map, ArrowLeft, Server } from "lucide-react";

export default function AdminRegionPage() {
    const { regionName } = useParams();
    const { token } = useAdminAuth();
    const [kiosks, setKiosks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRegion = async () => {
            try {
                const res = await axios.get(`${ENV.API_BASE_URL}/admin/kiosks`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    const regionalKiosks = res.data.kiosks.filter((k: any) => k.location?.region === regionName);
                    setKiosks(regionalKiosks);
                }
            } catch (err) {
                console.error("Failed to fetch region kiosks", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRegion();
    }, [regionName, token]);

    if (loading) return <div className="text-white">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 text-white">
                <Link to="/admin" className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-full transition">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Map className="text-blue-500" /> Kiosks in '{regionName}'
                </h1>
            </div>

            <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700">
                {kiosks.length === 0 ? (
                    <p className="text-gray-400">No kiosks found in this region.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {kiosks.map(k => (
                            <Link
                                to={`/admin/kiosk/${k.kioskId}`}
                                key={k._id}
                                className="block p-5 bg-neutral-700 hover:bg-neutral-600 rounded shadow transition border border-neutral-600"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-white truncate pr-2">{k.kioskName}</h3>
                                    <Server className={`w-5 h-5 shrink-0 ${k.liveConnected ? 'text-green-500' : 'text-red-500'}`} />
                                </div>
                                <div className="text-sm text-gray-300 space-y-1">
                                    <p>ID: <span className="font-mono text-xs">{k.kioskId}</span></p>
                                    <p className="truncate">City: {k.location?.city || "Unknown"}</p>
                                    <p>Status:
                                        {k.newConnection ? <span className="text-yellow-400 ml-1">Pending</span> :
                                            <span className={k.isActive ? "text-green-400 ml-1" : "text-red-400 ml-1"}>{k.isActive ? "Active" : "Inactive"}</span>
                                        }
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

