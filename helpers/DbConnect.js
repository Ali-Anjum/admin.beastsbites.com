// db.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

let isConnected = false;
let connectPromise = null;

async function removeStaleCustomerIndexes() {
  try {
    const indexes = await mongoose.connection.collection("customers").indexes();
    const hasClientIndex = indexes.some((index) => index.name === "client_id_1");

    if (hasClientIndex) {
      await mongoose.connection.collection("customers").dropIndex("client_id_1");
      console.log("✓ Removed stale client_id index from customers collection");
    }
  } catch (err) {
    if (err?.codeName !== "IndexNotFound" && err?.code !== 26) {
      console.error("Failed to clean up customer indexes:", err.message);
    }
  }
}

async function createDefaultUser() {
  try {
    const User = require("../Models/UserSchema");
    const existingUser = await User.findOne({ username: "buttbros" });

    if (existingUser) {
      console.log("✓ Default user 'buttbros' already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash("buttbros007", 10);
    const newUser = new User({
      user_id: Math.floor(100000 + Math.random() * 900000),
      username: "buttbros",
      password: hashedPassword,
      role: "Owner",
      is_active: true
    });

    await newUser.save();
    console.log("✓ Created default user 'buttbros' with role 'Owner'");
  } catch (err) {
    console.error("Error creating default user:", err.message);
  }
}

async function connectDB() {
  // Already connected
  if (isConnected) {
    return mongoose.connection;
  }

  // Connection in progress
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(async () => {
      isConnected = true;
      console.log("✓ Connected to MongoDB");
      await removeStaleCustomerIndexes();
      await createDefaultUser();
      return mongoose.connection;
    })
    .catch((err) => {
      console.error("✗ Failed to connect to MongoDB");
      console.error(err.message);
      process.exit(1);
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
}

async function disconnectDB() {
  if (!isConnected) return;

  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log("✓ MongoDB connection closed");
  } catch (err) {
    console.error("Error closing MongoDB connection:", err);
  }
}

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.log("MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await disconnectDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down...");
  await disconnectDB();
  process.exit(0);
});

module.exports = {
  connectDB,
  disconnectDB,
};