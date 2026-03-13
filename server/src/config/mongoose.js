import mongoose from "mongoose";

const connectMongoDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error("❌ MONGODB_URI is not defined in environment variables");
            process.exit(1);
        }

        await mongoose.connect(uri);
        console.log("✅ MongoDB successfully connected");
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

export default connectMongoDB;
