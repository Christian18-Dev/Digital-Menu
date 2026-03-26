import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "digital_menu";

if (!uri) {
  throw new Error("Missing MONGODB_URI in environment");
}

type MongoGlobal = typeof globalThis & {
  __mongoClientPromise?: Promise<MongoClient>;
};

const globalForMongo = globalThis as MongoGlobal;

const clientPromise =
  globalForMongo.__mongoClientPromise ??
  new MongoClient(uri).connect().then((client) => client);

if (process.env.NODE_ENV !== "production") {
  globalForMongo.__mongoClientPromise = clientPromise;
}

export async function getMongoClient() {
  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}
