import { MongoClient, type Db } from "mongodb";

import {
  isMongoConfigured,
  mongodbDatabaseName,
  mongodbUri,
} from "@/lib/mongodb/config";

const globalMongo = globalThis as unknown as {
  __buildRxMongoClient?: Promise<MongoClient>;
};

export async function getMongoDatabase(): Promise<Db> {
  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI is not configured.");
  }

  globalMongo.__buildRxMongoClient ??= new MongoClient(mongodbUri()!, {
    connectTimeoutMS: 3_000,
    serverSelectionTimeoutMS: 3_000,
    maxPoolSize: 8,
  })
    .connect()
    .catch((error) => {
      globalMongo.__buildRxMongoClient = undefined;
      throw error;
    });

  const client = await globalMongo.__buildRxMongoClient;
  return client.db(mongodbDatabaseName());
}
