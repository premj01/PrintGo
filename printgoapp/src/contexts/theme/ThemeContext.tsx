import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import type { ThemeMode } from "@/config/colors";
import { STORAGE_KEYS } from "@/config/constants";

// ===== Context Type =====
export interface ThemeContextType {
    theme: ThemeMode;
    toggleTheme: () => void;
    setTheme: (theme: ThemeMode) => void;
    isDark: boolean;
}

// ===== Context =====
export const ThemeContext = createContext<ThemeContextType | undefined>(
    undefined
);

// ===== Helper: Apply theme to DOM =====
function applyThemeToDom(mode: ThemeMode) {
    const root = document.documentElement;
    if (mode === "dark") {
        root.classList.add("dark");
    } else {
        root.classList.remove("dark");
    }
}

// ===== Helper: Detect system preference =====
function getSystemPreference(): ThemeMode {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

// ===== Helper: Get initial theme =====
function getInitialTheme(): ThemeMode {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode | null;
    if (stored === "light" || stored === "dark") return stored;
    return getSystemPreference();
}

// ===== Provider =====
interface ThemeProviderProps {
    children: ReactNode;
    defaultTheme?: ThemeMode;
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<ThemeMode>(
        defaultTheme ?? getInitialTheme()
    );

    // Apply .dark class on mount and whenever theme changes
    useEffect(() => {
        applyThemeToDom(theme);
    }, [theme]);

    // Listen for system preference changes
    useEffect(() => {
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (e: MediaQueryListEvent) => {
            const stored = localStorage.getItem(STORAGE_KEYS.THEME);
            if (!stored) {
                setThemeState(e.matches ? "dark" : "light");
            }
        };
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((prev) => {
            const next = prev === "light" ? "dark" : "light";
            localStorage.setItem(STORAGE_KEYS.THEME, next);
            return next;
        });
    }, []);

    const setTheme = useCallback((newTheme: ThemeMode) => {
        localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
        setThemeState(newTheme);
    }, []);

    const contextValue = useMemo<ThemeContextType>(
        () => ({
            theme,
            toggleTheme,
            setTheme,
            isDark: theme === "dark",
        }),
        [theme, toggleTheme, setTheme]
    );

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}
