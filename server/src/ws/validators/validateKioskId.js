import Kiosk from "../../models/kiosk.model.js";

/**
 * Validate that a kioskId exists in the database.
 * If it doesn't exist, create it as a new, unapproved connection.
 * Returns true to allow connection so admin can verify it.
 * @param {string} kioskId
 * @returns {Promise<boolean>}
 */
export async function validateKioskId(kioskId) {
    if (!kioskId) return false;

    try {
        const kiosk = await Kiosk.findOne(
            { kioskId },
            { _id: 1, isActive: 1 }
        ).lean();

        if (!kiosk) {
            console.log(`🆕 Unknown kiosk detected. Adding to database for approval: ${kioskId}`);
            // Create the kiosk with default tracking fields
            await Kiosk.create({
                kioskId,
                kioskName: kioskId,
                isActive: false,      // Requires admin verification
                newConnection: true,  // Marks this as newly discovered for the admin dashboard
            });
            // Return true to allow the WS connection. This lets the
            // agent connect, send its machineDetails, and wait for approval.
            return true;
        }

        // Kiosk exists. Allow connection regardless of isActive so it can
        // update its machineDetails and stay manageable by admin.
        return true;
    } catch (err) {
        console.error(`❌ validateKioskId DB error:`, err.message);
        return false;
    }
}
