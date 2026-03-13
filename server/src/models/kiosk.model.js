import mongoose from "mongoose";

const kioskSchema = new mongoose.Schema({
    // ── Core Identity ──────────────────────────────────────────────────────────
    kioskId: { type: String, required: true, unique: true, index: true }, // e.g. "KIOSK001"
    kioskName: { type: String },
    isActive: { type: Boolean, default: false }, // Admin must approve
    newConnection: { type: Boolean, default: true }, // Flag for new kiosks requiring review
    currentOwner: { type: String, default: "printgocorp" },

    // ── Location Details ─────────────────────────────────────────────────────
    location: {
        region: String,
        city: { type: String, index: true },
        address: String,
        landmark: String,
        pincode: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },

    // ── Printers Configuration ───────────────────────────────────────────────
    printers: {
        bw: {
            name: String,
            model: String,
            status: { type: String, default: "unknown" }, // online | offline | error | unknown
            paperAvailable: { type: Boolean, default: true },
            inkLevel: Number, // 0-100 percentage
            supportedFormats: [String],
            pricePerPage: Number
        },
        color: {
            name: String,
            model: String,
            status: { type: String, default: "unknown" },
            paperAvailable: { type: Boolean, default: true },
            inkLevel: { type: Map, of: Number }, // e.g. { cyan: 80, magenta: 60 }
            supportedFormats: [String],
            pricePerPage: Number
        }
    },

    // ── Machine Details (Auto-populated by agent) ────────────────────────────
    machineDetails: {
        hostname: String,
        platform: String,
        arch: String,
        ipAddress: String,
        capabilities: [String],
        status: { type: String, default: "offline", index: true }, // online | offline | maintenance
        lastSeenAt: Date
    },

    // ── Metrics & Financials ─────────────────────────────────────────────────
    metrics: {
        totalPrintJobs: { type: Number, default: 0 },
        revenue: {
            total: { type: Number, default: 0 },
            monthly: { type: Number, default: 0 },
            daily: { type: Number, default: 0 }
        }
    },

    // ── Operating Configuration ──────────────────────────────────────────────
    config: {
        operatingHours: {
            start: String, // e.g. "08:00"
            end: String    // e.g. "22:00"
        },
        maxFileSizeMB: { type: Number, default: 50 },
        supportedFileTypes: [String],
        notes: String
    }
}, {
    timestamps: true // Automatically adds createdAt & updatedAt
});

const Kiosk = mongoose.models.Kiosk || mongoose.model("Kiosk", kioskSchema);
export default Kiosk;
