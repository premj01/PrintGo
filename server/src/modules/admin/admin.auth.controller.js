import Admin from "../../models/admin.model.js";
import jwt from "jsonwebtoken";

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30m" });
};

export const registerAdmin = async (req, res) => {
    console.log("Admin Registration Request Start:", req.body);
    try {
        const { username, email, password, role } = req.body;

        console.log("Checking if admin exists...");
        const adminExists = await Admin.findOne({ $or: [{ email }, { username }] });
        if (adminExists) {
            console.log("Admin already exists");
            return res.status(400).json({ success: false, message: "Admin already exists" });
        }

        console.log("Counting documents...");
        const adminCount = await Admin.countDocuments();
        const isFirstAdmin = adminCount === 0;
        console.log(`First admin? ${isFirstAdmin}`);

        console.log("Creating admin...");
        const admin = await Admin.create({
            username,
            email,
            password,
            role: isFirstAdmin ? "superadmin" : role,
            isActive: isFirstAdmin
        });
        console.log("Admin created successfully");

        res.status(201).json({
            success: true,
            message: isFirstAdmin
                ? "First admin registered and activated as superadmin successfully."
                : "Admin registered successfully. Waiting for activation by superadmin.",
        });
    } catch (error) {
        console.error("Error in registerAdmin:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        if (!admin.isActive) {
            return res.status(403).json({ success: false, message: "Account is not active. Please contact superadmin." });
        }

        if (await admin.matchPassword(password)) {
            res.json({
                success: true,
                _id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                token: generateToken(admin._id, admin.role),
            });
        } else {
            res.status(401).json({ success: false, message: "Invalid email or password" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const logoutAdmin = (req, res) => {
    res.json({ success: true, message: "Logged out successfully" });
};

export const getMe = async (req, res) => {
    try {
        const admin = await Admin.findById(req.user.id).select("-password");
        if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });

        res.json({ success: true, admin });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllAdmins = async (req, res) => {
    try {
        const admins = await Admin.find({}).select("-password");
        res.json({ success: true, admins });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateAdminStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive, role } = req.body;

        const admin = await Admin.findById(id);
        if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });

        // Don't allow deactivating self if superadmin
        if (id === req.user.id && isActive === false) {
            return res.status(400).json({ success: false, message: "Cannot deactivate yourself" });
        }

        if (isActive !== undefined) admin.isActive = isActive;
        if (role !== undefined) admin.role = role;

        await admin.save();
        res.json({ success: true, message: "Admin status updated", admin });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};