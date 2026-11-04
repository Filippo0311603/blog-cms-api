import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface DatabaseHandle {
  /** Closes the Mongoose connection (and the in-memory server, if one was started). */
  close: () => Promise<void>;
}

/** Connects Mongoose to the given URI. */
export async function connectDb(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.STATES.connected;
}

/**
 * Connects using MONGODB_URI when set. In development with no URI, starts an
 * in-memory MongoDB so the project runs with zero setup (data is NOT persisted).
 */
export async function initDatabase(): Promise<DatabaseHandle> {
  if (env.MONGODB_URI) {
    await connectDb(env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    return { close: disconnectDb };
  }

  if (env.NODE_ENV !== 'development') {
    throw new Error('MONGODB_URI is required when NODE_ENV is not "development"');
  }

  // Dynamic import: mongodb-memory-server is a devDependency, never loaded in production.
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const memoryServer = await MongoMemoryServer.create();
  const uri = `${memoryServer.getUri()}blogcms`;
  await connectDb(uri);
  logger.warn(
    'MONGODB_URI is not set: using an IN-MEMORY MongoDB. Data is NOT persisted and is lost on restart.',
  );
  return {
    close: async () => {
      await disconnectDb();
      await memoryServer.stop();
    },
  };
}
