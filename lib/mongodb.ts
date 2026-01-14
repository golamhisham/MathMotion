import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'mathmotion';

// Type for cached client
interface CachedClient {
  client: MongoClient | null;
  db: Db | null;
}

// Global cache for MongoDB client (reused across HMR in dev)
declare global {
  var _mongoClientPromise: Promise<CachedClient> | undefined;
}

let cached = global._mongoClientPromise;

async function connectToDatabase(): Promise<CachedClient> {
  if (cached) {
    return cached;
  }

  const mongoClient = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  cached = (async () => {
    try {
      await mongoClient.connect();
      const db = mongoClient.db(MONGODB_DB_NAME);

      // Verify connection
      await db.admin().ping();
      console.log('Connected to MongoDB');

      return {
        client: mongoClient,
        db: db,
      };
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  })();

  global._mongoClientPromise = cached;
  return cached;
}

export async function getDatabase(): Promise<Db> {
  const { db } = await connectToDatabase();
  if (!db) {
    throw new Error('Failed to get database connection');
  }
  return db;
}

export async function getClient(): Promise<MongoClient> {
  const { client } = await connectToDatabase();
  if (!client) {
    throw new Error('Failed to get MongoDB client');
  }
  return client;
}
