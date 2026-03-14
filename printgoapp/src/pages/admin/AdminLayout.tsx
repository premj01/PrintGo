import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { LayoutDashboard, Server, Settings, LogOut, Map, Users } from "lucide-react";

export function AdminLayout() {
    const { user, loading, logout } = useAdminAuth();
    const location = useLocation();

    if (loading) return <div className="h-screen flex items-center justify-center bg-neutral-900 text-white">Loading...</div>;

    // Protect routes
    if (!user) return <Navigate to="/admin/login" replace />;

    const navItems = [
        { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
        { name: "Regions", path: "/admin/regions", icon: Map },
        { name: "Settings", path: "/admin/settings", icon: Settings },
    ];

    if (user.role === "superadmin") {
        navItems.push({ name: "Accounts", path: "/admin/accounts", icon: Users });
    }

    return (
        <div className="min-h-screen flex bg-neutral-900 text-neutral-200">
            {/* Sidebar */}
            <aside className="w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col">
                <div className="p-6 border-b border-neutral-800">
                    <h1 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Server className="w-6 h-6 text-blue-500" /> PrintGo Admin
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-neutral-800 text-neutral-400'}`}
                            >
                                <Icon className="w-5 h-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-neutral-800">
                    <div className="px-4 py-2 mb-2 text-sm text-neutral-400">
                        Logged in as: <span className="text-white block font-medium truncate">{user.username}</span>
                        <span className="text-xs uppercase bg-neutral-800 px-2 py-1 rounded inline-block mt-1">{user.role}</span>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-neutral-800 hover:text-red-300 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
