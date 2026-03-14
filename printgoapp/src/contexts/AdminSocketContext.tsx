import { createContext, useContext, useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import { useAdminAuth } from "./AdminAuthContext";
import { ENV } from "@/config/env";

interface AdminSocketContextType {
    socket: WebSocket | null;
    lastMessage: any;
    sendCommand: (kioskId: string, cmd: string, data?: any) => void;
}

const AdminSocketContext = createContext<AdminSocketContextType | undefined>(undefined);

export function AdminSocketProvider({ children }: { children: ReactNode }) {
    const { token } = useAdminAuth();
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!token) {
            if (wsRef.current) wsRef.current.close();
            return;
        }

        const wsUrl = `${ENV.WS_BASE_URL}/?role=admin&token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("🟢 Admin WebSocket connected");
            setSocket(ws);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                setLastMessage({ ...msg, _ts: Date.now() }); // Include timestamp to force updates even on identical payloads
            } catch (err) {
                console.error("Failed to parse admin WS message", err);
            }
        };

        ws.onerror = (error) => console.error("Admin WebSocket error", error);

        ws.onclose = () => {
            console.log("🔴 Admin WebSocket disconnected");
            setSocket(null);
            wsRef.current = null;
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) ws.close();
        };
    }, [token]);

    const sendCommand = (kioskId: string, cmd: string, data = {}) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log(`Sending command: ${cmd} to ${kioskId}`, data);
            wsRef.current.send(JSON.stringify({
                type: cmd,
                targetKioskId: kioskId,
                // Keep both fields because backend handlers may read either shape.
                data: { kioskId, ...data }
            }));
        } else {
            console.error("Cannot send command, websocket not open");
        }
    };

    return (
        <AdminSocketContext.Provider value={{ socket, lastMessage, sendCommand }}>
            {children}
        </AdminSocketContext.Provider>
    );
}

export const useAdminSocket = () => {
    const ctx = useContext(AdminSocketContext);
    if (!ctx) throw new Error("useAdminSocket must be used within AdminSocketProvider");
    return ctx;
};
