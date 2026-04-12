import { connectMongo } from "../db/mongo";

const connectDB = async () => {
  try {
    await connectMongo();
  } catch (error) {
    console.error(`Database initialisation failed: ${(error as Error).message}`);
    process.exit(1);
  }
};

export default connectDB;
