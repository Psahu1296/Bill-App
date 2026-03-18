import { getDb } from "../db";

const connectDB = () => {
  try {
    getDb(); // opens the SQLite file and initialises schema
    console.log("✅ SQLite database ready");
  } catch (error) {
    console.error(`Database initialisation failed: ${(error as Error).message}`);
    process.exit(1);
  }
};

export default connectDB;
