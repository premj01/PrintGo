import { useCallback } from "react";
import { STORAGE_KEYS } from "@/config/constants";

/**
 * Hook to manage kiosk session data (userSessionNumber from QR code scan).
 */
export function useKioskSession() {
    const getSessionNumber = useCallback((): string | null => {
        return localStorage.getItem(STORAGE_KEYS.KIOSK_SESSION);
    }, []);

    const setSessionNumber = useCallback((sessionNumber: string): void => {
        localStorage.setItem(STORAGE_KEYS.KIOSK_SESSION, sessionNumber);
    }, []);

    const clearSession = useCallback((): void => {
        localStorage.removeItem(STORAGE_KEYS.KIOSK_SESSION);
        localStorage.removeItem(STORAGE_KEYS.KIOSK_AUTH_SESSION);
    }, []);

    return {
        getSessionNumber,
        setSessionNumber,
        clearSession,
    };
}
