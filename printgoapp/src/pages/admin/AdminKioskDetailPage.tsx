import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useAdminSocket } from "@/contexts/AdminSocketContext";
import { ENV } from "@/config/env";
import { ArrowLeft, RefreshCw, Printer, Info, MapPin, TerminalSquare } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

export default function AdminKioskDetailPage() {
    const { kioskId } = useParams();
    const { token } = useAdminAuth();
    const { lastMessage, sendCommand } = useAdminSocket();

    const [kiosk, setKiosk] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form states
    const [isActive, setIsActive] = useState(false);
    const [newConnection, setNewConnection] = useState(false);
    const [location, setLocation] = useState({ region: "", city: "", address: "" });
    const [bwPrinter, setBwPrinter] = useState({ name: "", model: "", pricePerPage: 0 });
    const [colorPrinter, setColorPrinter] = useState({ name: "", model: "", pricePerPage: 0 });
    const [lockedBy, setLockedBy] = useState<string | null>(null);
    const [isViewDenied, setIsViewDenied] = useState(false);
    
    // Real-time printer list from kiosk
    const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
    const [selectedBwPrinter, setSelectedBwPrinter] = useState<string>("");
    const [selectedColorPrinter, setSelectedColorPrinter] = useState<string>("");

    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);

    useEffect(() => {
        fetchKiosk();
        // Request exclusive view
        sendCommand(kioskId!, "view-kiosk");

        return () => {
            // Release lock on unmount
            sendCommand(kioskId!, "leave-kiosk");
        };
    }, [kioskId, token]);

    // WebSocket updates handler
    useEffect(() => {
        const messageKioskId = lastMessage?.kioskId ?? lastMessage?.data?.kioskId;
        if (!lastMessage || messageKioskId !== kioskId) return;

        console.log("WS Data received:", lastMessage);
        if (lastMessage.type === "agent-heartbeat") {
            setKiosk((prev: any) => prev ? {
                ...prev,
                agentConnected: true,
                machineDetails: { ...prev.machineDetails, lastSeenAt: lastMessage.timestamp }
            } : null);
        } else if (
            lastMessage.type === "kiosk-status-result" ||
            lastMessage.type === "printer-list-result" ||
            lastMessage.type === "system-info-result"
        ) {
            // Capture printer list from kiosk response
            if (lastMessage.type === "printer-list-result" && lastMessage.data) {
                const printers = lastMessage.data.printers || [];
                const colorPrinters = lastMessage.data.colorPrinters || [];
                const bwPrinters = lastMessage.data.bwPrinters || [];
                setAvailablePrinters(printers);
                
                // Auto-select first printers if not already selected
                if (!selectedBwPrinter && bwPrinters.length > 0) {
                    setSelectedBwPrinter(bwPrinters[0].name);
                }
                if (!selectedColorPrinter && colorPrinters.length > 0) {
                    setSelectedColorPrinter(colorPrinters[0].name);
                }
            }
            fetchKiosk();
        } else if (lastMessage.type === "view-kiosk-result") {
            if (lastMessage.success) {
                setLockedBy(null);
                setIsViewDenied(false);
            } else {
                setLockedBy(lastMessage.lockedBy || "Another Admin");
                setIsViewDenied(true);
            }
        } else if (lastMessage.type === "kiosk-lock-update") {
            // Global update about locks
            const kioskLock = lastMessage.kiosks?.find((k: any) => k.kioskId === kioskId);
            if (kioskLock) setLockedBy(kioskLock.lockedBy);
        } else if (lastMessage.type === "terminal-output") {
            if (xtermRef.current) xtermRef.current.write(lastMessage.data ?? lastMessage.output ?? "");
        }
    }, [lastMessage, kioskId]);

    const fetchKiosk = async () => {
        try {
            const res = await axios.get(`${ENV.API_BASE_URL}/admin/kiosks/${kioskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const k = res.data.kiosk;
                setKiosk(k);
                setIsActive(k.isActive);
                setNewConnection(k.newConnection);
                setLocation(k.location || { region: "", city: "", address: "" });
                setBwPrinter(k.printers?.bw || { name: "", model: "", pricePerPage: 0 });
                setColorPrinter(k.printers?.color || { name: "", model: "", pricePerPage: 0 });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (section: string, dataPayload: any) => {
        setSaving(true);
        try {
            await axios.patch(`${ENV.API_BASE_URL}/admin/kiosks/${kioskId}`, dataPayload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`${section} updated successfully`);
            fetchKiosk(); // Refresh
        } catch (err) {
            alert(`Failed to update ${section}`);
        } finally {
            setSaving(false);
        }
    };

    const toggleTerminal = () => {
        if (!xtermRef.current && terminalRef.current) {
            const term = new Terminal({ rows: 15, cursorBlink: true, theme: { background: '#171717' } });
            term.open(terminalRef.current);
            xtermRef.current = term;

            term.onData(data => {
                sendCommand(kioskId!, "terminal-input", { input: data });
            });

            sendCommand(kioskId!, "open-terminal-request");
            term.writeln("Requesting terminal from agent...");
        } else if (xtermRef.current) {
            sendCommand(kioskId!, "close-terminal-request");
            xtermRef.current.dispose();
            xtermRef.current = null;
        }
    };

    if (loading) return <div className="text-white">Loading Kiosk...</div>;
    if (!kiosk) return <div className="text-red-500">Kiosk not found.</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-white">
                    <Link to="/admin" className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-full transition">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            {kiosk.kioskName}
                            {kiosk.agentConnected ? (
                                <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded border border-green-500/30">Online</span>
                            ) : (
                                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded border border-red-500/30">Offline</span>
                            )}
                        </h1>
                        <p className="text-gray-400 text-sm font-mono mt-1">{kiosk.kioskId}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        disabled={isViewDenied}
                        onClick={() => sendCommand(kioskId!, "restart-kiosk-request")}
                        className={`bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition ${isViewDenied ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <RefreshCw className="w-4 h-4" /> Restart Services
                    </button>
                    <button
                        disabled={isViewDenied}
                        onClick={toggleTerminal}
                        className={`bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition border border-neutral-600 ${isViewDenied ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <TerminalSquare className="w-4 h-4 text-green-400" /> Terminal
                    </button>
                </div>
            </div>

            {isViewDenied && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center justify-between text-red-200">
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5" />
                        <span>This kiosk is currently being managed by <strong>{lockedBy}</strong>. Remote controls are disabled.</span>
                    </div>
                </div>
            )}

            {/* Terminal Container */}
            <div ref={terminalRef} className="w-full bg-black rounded overflow-hidden"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Status Block */}
                <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700">
                    <h2 className="text-lg font-bold text-white mb-4 border-b border-neutral-700 pb-2 flex items-center gap-2">
                        <Info className="text-blue-500" /> Status & Operations
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-300">Is Active?</span>
                            <button
                                onClick={() => setIsActive(!isActive)}
                                className={`w-12 h-6 rounded-full relative transition-colors ${isActive ? 'bg-green-500' : 'bg-neutral-600'}`}
                            >
                                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isActive ? 'translate-x-6' : ''}`}></span>
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-gray-300">New Connection Flag</span>
                            <button
                                onClick={() => setNewConnection(!newConnection)}
                                className={`w-12 h-6 rounded-full relative transition-colors ${newConnection ? 'bg-yellow-500' : 'bg-neutral-600'}`}
                            >
                                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${newConnection ? 'translate-x-6' : ''}`}></span>
                            </button>
                        </div>

                        <button
                            disabled={saving || isViewDenied}
                            onClick={() => handleSave("Status Flags", { isActive, newConnection })}
                            className={`w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition ${isViewDenied ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            Update Status Flags
                        </button>
                    </div>
                </div>

                {/* Location Block */}
                <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700">
                    <h2 className="text-lg font-bold text-white mb-4 border-b border-neutral-700 pb-2 flex items-center gap-2">
                        <MapPin className="text-pink-500" /> Geographical Data
                    </h2>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Region</label>
                            <input value={location.region} onChange={e => setLocation({ ...location, region: e.target.value })} className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded focus:border-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider">City</label>
                            <input value={location.city} onChange={e => setLocation({ ...location, city: e.target.value })} className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded focus:border-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Address</label>
                            <input value={location.address} onChange={e => setLocation({ ...location, address: e.target.value })} className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded focus:border-blue-500 outline-none" />
                        </div>

                        <button
                            disabled={saving}
                            onClick={() => handleSave("Location", { location })}
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition"
                        >
                            Update Location
                        </button>
                    </div>
                </div>

                {/* B&W Printer Block */}
                <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700">
                    <div className="flex justify-between items-center border-b border-neutral-700 pb-2 mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Printer className="text-gray-400" /> B&W Printer Config
                        </h2>
                        <button onClick={() => sendCommand(kioskId!, "get-printers-request")} className="text-xs text-blue-400 hover:underline">Sync Hardware</button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Select B&W Printer</label>
                            <select 
                                value={selectedBwPrinter || bwPrinter.name}
                                onChange={e => {
                                    setSelectedBwPrinter(e.target.value);
                                    setBwPrinter({ ...bwPrinter, name: e.target.value, model: e.target.value });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded focus:border-blue-500 outline-none"
                            >
                                <option value="">-- Select B&W Printer --</option>
                                {availablePrinters
                                    .map((printer, idx) => (
                                    <option key={idx} value={printer.name}>
                                        {printer.name} ({printer.status})
                                    </option>
                                ))}
                                {availablePrinters.length === 0 && (
                                    <option value="" disabled>No B&W printers found - Sync Hardware</option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Current In Use Printer</label>
                            <input value={bwPrinter.model} disabled className="w-full bg-neutral-800 border border-neutral-600 text-gray-400 px-3 py-2 rounded cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Price Per Page (₹)</label>
                            <input type="number" step="0.5" value={bwPrinter.pricePerPage} onChange={e => setBwPrinter({ ...bwPrinter, pricePerPage: Number(e.target.value) })} className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded focus:border-blue-500 outline-none" />
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button disabled={saving} onClick={() => handleSave("B&W Printer", { "printers.bw": bwPrinter })} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition">Save</button>
                            <button onClick={() => sendCommand(kioskId!, "test-print-request", { printer: bwPrinter.name || selectedBwPrinter })} className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 rounded border border-neutral-600">Test</button>
                        </div>
                    </div>
                </div>

                {/* Color Printer Block */}
                <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700">
                    <div className="flex justify-between items-center border-b border-neutral-700 pb-2 mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Printer className="text-indigo-500" /> Color Printer Config
                        </h2>
                        <button onClick={() => sendCommand(kioskId!, "get-printers-request")} className="text-xs text-blue-400 hover:underline">Sync Hardware</button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Select Color Printer</label>
                            <select 
                                value={selectedColorPrinter || colorPrinter.name}
                                onChange={e => {
                                    setSelectedColorPrinter(e.target.value);
                                    setColorPrinter({ ...colorPrinter, name: e.target.value, model: e.target.value });
                                }}
                                className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded focus:border-blue-500 outline-none"
                            >
                                <option value="">-- Select Color Printer --</option>
                                {availablePrinters
                                    .map((printer, idx) => (
                                    <option key={idx} value={printer.name}>
                                        {printer.name} ({printer.status})
                                    </option>
                                ))}
                                {availablePrinters.length === 0 && (
                                    <option value="" disabled>No color printers found - Sync Hardware</option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Current In Use Printer</label>
                            <input value={colorPrinter.model} disabled className="w-full bg-neutral-800 border border-neutral-600 text-gray-400 px-3 py-2 rounded cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Price Per Page (₹)</label>
                            <input type="number" step="1" value={colorPrinter.pricePerPage} onChange={e => setColorPrinter({ ...colorPrinter, pricePerPage: Number(e.target.value) })} className="w-full bg-neutral-900 border border-neutral-700 text-white px-3 py-2 rounded focus:border-blue-500 outline-none" />
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button disabled={saving} onClick={() => handleSave("Color Printer", { "printers.color": colorPrinter })} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition">Save</button>
                            <button onClick={() => sendCommand(kioskId!, "test-print-request", { printer: colorPrinter.name || selectedColorPrinter })} className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 rounded border border-neutral-600">Test</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
