// ===== User Types =====
export interface User {
    email: string;
    name: string;
    picture: string;
}

// ===== Auth Types =====
export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

export interface AuthContextType extends AuthState {
    login: (code: string) => Promise<void>;
    logout: () => void;
    setUser: (user: User) => void;
}

// ===== API Response Types =====
export interface AuthResponse {
    token: string;
    user: User;
}

export interface ApiError {
    error: string;
    message?: string;
    statusCode?: number;
}

// ===== Upload Types =====
export interface UploadResponse {
    success: boolean;
    message: string;
    fileId?: string;
    fileName?: string;
}

// ===== Route Types =====
export interface NavLink {
    label: string;
    href: string;
    requiresAuth?: boolean;
}

// ===== Kiosk Types =====
export interface KioskSession {
    userSessionNumber: string;
}
