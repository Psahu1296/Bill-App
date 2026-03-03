import mongoose from "mongoose";
import fs from 'fs';
import path from 'path';

import config from "./config";

// const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../system.config.json'), 'utf8'));
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.databaseURI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error: any) {
        console.log(`❌ Database connection failed: ${error.message}`);
        process.exit();
    }
}

export default connectDB;