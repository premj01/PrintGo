import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import { ENV } from "@/config/env";

interface AdminUser {
    _id: string;
    username: string;
    email: string;
    role: string;
}

interface AdminAuthContextType {
    user: AdminUser | null;
    token: string | null;
    login: (token: string, userData: AdminUser) => void;
    logout: () => void;
    loading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem("adminToken"));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            axios.get(`${ENV.API_BASE_URL}/admin/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => {
                    if (res.data.success) {
                        setUser(res.data.admin);
                    } else {
                        logout();
                    }
                })
                .catch(() => logout())
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [token]);

    const login = (newToken: string, userData: AdminUser) => {
        localStorage.setItem("adminToken", newToken);
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem("adminToken");
        setToken(null);
        setUser(null);
    };

    return (
        <AdminAuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AdminAuthContext.Provider>
    );
}

export const useAdminAuth = () => {
    const context = useContext(AdminAuthContext);
    if (!context) throw new Error("useAdminAuth must be used within AdminAuthProvider");
    return context;
};
