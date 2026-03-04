import { STORAGE_KEYS } from "@/config/constants";

/**
 * Hook to manage kiosk session data (userSessionNumber from QR code scan).
 */
export function useKioskSession() {
    const getSessionNumber = (): string | null => {
        return localStorage.getItem(STORAGE_KEYS.KIOSK_SESSION);
    };

    const setSessionNumber = (sessionNumber: string): void => {
        localStorage.setItem(STORAGE_KEYS.KIOSK_SESSION, sessionNumber);
    };

    const clearSession = (): void => {
        localStorage.removeItem(STORAGE_KEYS.KIOSK_SESSION);
    };

    return {
        getSessionNumber,
        setSessionNumber,
        clearSession,
    };
}
