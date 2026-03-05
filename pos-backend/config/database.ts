import mongoose from "mongoose";
import config from "./config";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.databaseURI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.log(`Database connection failed: ${(error as Error).message}`);
        process.exit(1);
    }
}

export default connectDB;