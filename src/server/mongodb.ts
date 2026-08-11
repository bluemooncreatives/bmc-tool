import { MongoClient, type Db } from 'mongodb'
import { getMongoUri } from './env'

/**
 * A single MongoClient is shared across the process. In development Next
 * re-evaluates modules on every hot reload, which would otherwise open a new
 * connection pool each time until Atlas refuses them, so the promise is
 * stashed on globalThis and reused across reloads.
 */
const globalForMongo = globalThis as typeof globalThis & {
  __bmcMongoClientPromise?: Promise<MongoClient>
}

function connect(): Promise<MongoClient> {
  return new MongoClient(getMongoUri()).connect()
}

export function getMongoClient(): Promise<MongoClient> {
  if (!globalForMongo.__bmcMongoClientPromise) {
    globalForMongo.__bmcMongoClientPromise = connect().catch((error) => {
      // Do not cache a failed connection, or every later request reuses it.
      globalForMongo.__bmcMongoClientPromise = undefined
      throw error
    })
  }
  return globalForMongo.__bmcMongoClientPromise
}

/** Resolves the database named in MONGODB_URI (bmc_tool). */
export async function getDb(): Promise<Db> {
  const client = await getMongoClient()
  return client.db()
}
