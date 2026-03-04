import authRoutes from "../modules/auth/auth.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import userRoutes from "../modules/user/user.routes.js";
import uploadRoutes from "../modules/upload/upload.routes.js";
import systemRoutes from "../modules/system/system.routes.js";

export function registerRoutes(app) {
    app.use("/userdocs", uploadRoutes);

    app.use("/auth", authRoutes);
    app.use("/admin", adminRoutes);
    app.use("/", userRoutes);
    app.use("/", systemRoutes);
}
