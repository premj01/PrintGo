import { useContext } from "react";
import { AuthContext } from "@/contexts/auth";
import type { AuthContextType } from "@/types";

/**
 * Custom hook to access the AuthContext.
 * Throws if used outside of AuthProvider.
 */
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
