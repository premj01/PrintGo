import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import type { AuthContextType, AuthState, User } from "@/types";
import { authService } from "@/services";
import { STORAGE_KEYS } from "@/config/constants";

// ===== Initial State =====
const initialState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
};

// ===== Context =====
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===== Provider =====
interface AuthProviderProps {
    children: ReactNode;
}     

export function AuthProvider({ children }: AuthProviderProps) {
    const [state, setState] = useState<AuthState>(initialState);

    // Hydrate auth state from localStorage on mount
    useEffect(() => {
        try {
            const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
            const storedUser = localStorage.getItem(STORAGE_KEYS.USER);

            if (storedToken && storedUser) {
                const user: User = JSON.parse(storedUser);
                setState({
                    user,
                    token: storedToken,
                    isAuthenticated: true,
                    isLoading: false,
                });
            } else {
                setState((prev) => ({ ...prev, isLoading: false }));
            }
        } catch {
            // Corrupted data in localStorage — clear and reset
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER);
            setState({ ...initialState, isLoading: false });
        }
    }, []);

    // Login: exchange OAuth code → save user + token
    const login = useCallback(async (code: string) => {
        setState((prev) => ({ ...prev, isLoading: true }));
        try {
            const data = await authService.googleLogin(code);

            localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));

            setState({
                user: data.user,
                token: data.token,
                isAuthenticated: true,
                isLoading: false,
            });
        } catch (error) {
            console.error("Login failed:", error);
            setState({ ...initialState, isLoading: false });
            throw error;
        }
    }, []);

    // Logout: clear everything
    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        setState({ ...initialState, isLoading: false });
    }, []);

    // Set user manually (e.g., profile updates)
    const setUser = useCallback((user: User) => {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        setState((prev) => ({ ...prev, user }));
    }, []);

    const contextValue = useMemo<AuthContextType>(
        () => ({
            ...state,
            login,
            logout,
            setUser,
        }),
        [state, login, logout, setUser]
    );

    return (
        <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
    );
}