import Kiosk from "../models/kiosk.model.js";

// Discovery may seed an empty slot. A refresh must preserve an administrator's assignment.
export async function updatePrinterInventory(kioskId, update) {
    await Kiosk.updateOne({ kioskId }, { $set: { "printers.availableList": update["printers.availableList"] } });
    for (const mode of ["bw", "color"]) {
        const prefix = "printers." + mode + ".";
        const nameField = prefix + "name";
        if (!update[nameField]) continue;
        const defaults = Object.fromEntries(Object.entries(update).filter(([key]) => key.startsWith(prefix)));
        await Kiosk.updateOne({ kioskId, [nameField]: { $in: [null, "", "dummy", update[nameField]] } }, { $set: defaults });
    }
}
