export function validateKioskId(kioskId) {
    const validKiosks = ["KIOSK001", "KIOSK002", "KIOSK003"];
    return validKiosks.includes(kioskId);
}
