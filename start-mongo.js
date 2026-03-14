const { MongoMemoryServer } = require("mongodb-memory-server");

async function start() {
  try {
    console.log("Starting in-memory MongoDB on port 27017...");
    const mongod = await MongoMemoryServer.create({
      instance: {
        port: 27017
      }
    });
    console.log(`✅ MongoDB running at: ${mongod.getUri()}`);
    // Keep the process alive
    setInterval(() => {}, 1000);
  } catch (err) {
    console.error("Failed to start MongoDB:", err);
    process.exit(1);
  }
}

start();
