import api from "./api";
import type { AuthResponse } from "@/types";

// ===== Auth Service =====
// All auth-related API calls

export const authService = {
    /**
     * Exchange Google OAuth authorization code for app JWT + user data
     */
    async googleLogin(code: string): Promise<AuthResponse> {
        const response = await api.post<AuthResponse>("/auth/google", { code });
        return response.data;
    },

    /**
     * Health-check / probe the auth route
     */
    async probe(): Promise<string> {
        const response = await api.get<string>("/auth/pr");
        return response.data;
    },
};
