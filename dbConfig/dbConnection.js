const mongodb = require("mongodb");
const mongoClient = mongodb.MongoClient;
let _db;
let dbConnectionStatus = "DISCONNECTED";
require("dotenv").config();

const uri = process.env.MONGO_URI;
console.log("🔗 MongoDB URI:", uri ? "Provided" : "Not provided");
const client = new mongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 50,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 60000,
  heartbeatFrequencyMS: 10000,
  retryReads: true,
});

const mongoConnect = async () => {
  try {
    if (!_db) {
      await client.connect();
      console.log("✅ MongoDB connected");
      dbConnectionStatus = "CONNECTED";

      _db = client.db();
    }
    return _db;
  } catch (e) {
    console.error("❌ Mongo connection error:", e);
    dbConnectionStatus = "DISCONNECTED";
    throw e;
  }
};

const getDb = () => {
  if (_db) return _db;
  throw new Error("❌ No DB found. Did you call mongoConnect()?");
};

const getDbConnectionStatus = () => dbConnectionStatus;
module.exports = {
  mongoConnect,
  getDb,
  getDbConnectionStatus,
};
