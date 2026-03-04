import { useContext } from "react";
import { ThemeContext } from "@/contexts/theme";
import type { ThemeContextType } from "@/contexts/theme";

/**
 * Custom hook to access the ThemeContext.
 * Throws if used outside of ThemeProvider.
 */
export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
